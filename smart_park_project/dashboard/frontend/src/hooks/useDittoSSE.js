import { useEffect, useRef, useState, useCallback } from 'react'
import DittoQueryBuilder from '../utils/DittoQueryBuilder'

const DITTO_AUTH = 'Basic ' + btoa('ditto:ditto')

/**
 * Approccio Ibrido per la gestione dei Things Ditto:
 *
 *   A) Caricamento Iniziale (HTTP + Cursore)
 *      → GET /api/2/search/things?size=200&fields=...
 *      → Paginazione automatica con cursor per scaricare TUTTI i things
 *
 *   B) Ascolto Mutazioni (Server-Sent Events)
 *      → GET /api/2/things?fields=...  (Accept: text/event-stream)
 *      → Riceve eventi: created, modified, deleted
 *      → Aggiorna lo state React in tempo reale
 *
 * Restituisce { things, connected }
 *   things: Map<thingId, { thingId, attributes, features, ...flatTelemetry }>
 */
export function useDittoSSE() {
  const [things, setThings]       = useState({})
  const [connected, setConnected] = useState(false)
  const controllerRef = useRef(null)

  // ── Merge: aggiorna un singolo thing nello state ─────────────────────────
  const merge = useCallback((thingId, patch) => {
    setThings(prev => ({
      ...prev,
      [thingId]: { ...(prev[thingId] || {}), ...patch }
    }))
  }, [])

  // ── Remove: rimuove un thing dallo state (evento deleted) ────────────────
  const remove = useCallback((thingId) => {
    setThings(prev => {
      const next = { ...prev }
      delete next[thingId]
      return next
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller

    // Helper: flattens Ditto thing → struttura piatta per il frontend
    const processPayload = (payload) => {
      const thingId = payload.thingId
      if (!thingId) return

      // Deep-merge features: preserva le features esistenti e aggiorna solo quelle arrivate
      // Questo è critico per i partial SSE events (es. modifica desiredProperties)
      // che contengono solo la feature modificata, non l'intero Thing.
      const deepMergeFeatures = (existing = {}, incoming = {}) => {
        const result = { ...existing }
        for (const [featName, featVal] of Object.entries(incoming)) {
          if (!featVal || typeof featVal !== 'object') {
            result[featName] = featVal
            continue
          }
          const existingFeat = existing[featName] || {}
          result[featName] = {
            ...existingFeat,
            properties:        { ...(existingFeat.properties || {}),        ...(featVal.properties || {}) },
            desiredProperties: { ...(existingFeat.desiredProperties || {}), ...(featVal.desiredProperties || {}) },
          }
        }
        return result
      }

      const incomingFeats = payload.features || {}
      const incomingAttrs = payload.attributes || {}

      // Ricostruiamo il flat delle SOLE properties che arrivano in questo evento
      const flat = {}
      for (const [, featVal] of Object.entries(incomingFeats)) {
        const props = featVal?.properties || {}
        Object.assign(flat, props)
      }

      setThings(prev => {
        const existing = prev[thingId] || {}
        const mergedFeatures = deepMergeFeatures(existing.features || {}, incomingFeats)

        // Attributes: merge, ma non sovrascrivere con {} se il patch non le porta
        const mergedAttrs = Object.keys(incomingAttrs).length > 0
          ? { ...(existing.attributes || {}), ...incomingAttrs }
          : (existing.attributes || {})

        return {
          ...prev,
          [thingId]: {
            ...existing,
            thingId,
            attributes: mergedAttrs,
            features:   mergedFeatures,
            // Aggiorna i campi piatti SOLO se l'evento ne porta di nuovi
            ...(Object.keys(flat).length > 0 ? flat : {}),
          }
        }
      })
    }


    const connect = async () => {
      try {
        // ═══════════════════════════════════════════════════════════════════
        // A) CARICAMENTO INIZIALE — HTTP + Cursore (Search API)
        //    Scarica TUTTI i things con paginazione automatica.
        //    DittoQueryBuilder.executeAll() gestisce il loop sui cursori.
        // ═══════════════════════════════════════════════════════════════════
        const builder = new DittoQueryBuilder()
          .selectFields(['thingId', 'features', 'attributes'])
          .setPageSize(200)

        const allThings = await builder.executeAll({ signal: controller.signal })
        console.log(`[Ditto] Snapshot caricato: ${allThings.length} things`)
        allThings.forEach(processPayload)

        // ═══════════════════════════════════════════════════════════════════
        // B) ASCOLTO MUTAZIONI — Server-Sent Events (Things API)
        //    /api/2/things supporta SSE (Accept: text/event-stream)
        //    Riceve eventi created/modified/deleted in tempo reale.
        //    La Search API NON supporta SSE.
        // ═══════════════════════════════════════════════════════════════════
        const sseUrl = '/ditto/2/things?fields=thingId,features,attributes'
        const res = await fetch(sseUrl, {
          headers: {
            'Accept':        'text/event-stream',
            'Authorization': DITTO_AUTH,
          },
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          console.error('[SSE] Ditto non raggiungibile, status:', res.status)
          setConnected(false)
          return
        }

        setConnected(true)
        console.log('[SSE] Stream connesso — in ascolto per mutazioni')

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() // mantieni riga incompleta

          let eventType = 'modified'
          let dataLines = []

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim())
            } else if (line === '') {
              // ── Dispatch evento ──────────────────────────────────────
              if (dataLines.length) {
                try {
                  const payload = JSON.parse(dataLines.join('\n'))

                  if (eventType === 'deleted') {
                    // Thing eliminato → rimuovi dal state e dalla mappa
                    if (payload.thingId) {
                      console.log('[SSE] Thing eliminato:', payload.thingId)
                      remove(payload.thingId)
                    }
                  } else {
                    // created o modified → aggiorna/aggiungi nello state
                    processPayload(payload)
                  }
                } catch { /* skip malformed SSE data */ }
              }
              eventType = 'modified'
              dataLines = []
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[SSE] Disconnesso, riconnessione in 5s:', err.message)
          setConnected(false)
          setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      controller.abort()
      setConnected(false)
    }
  }, [merge, remove])

  return { things, connected }
}
