import { useEffect, useRef, useState, useCallback } from 'react'
import DittoQueryBuilder from '../utils/DittoQueryBuilder'

const DITTO_AUTH = 'Basic ' + btoa('ditto:ditto')

/**
 * Connects to Ditto Server-Sent Events endpoint.
 * Listens to twin-modified events and updates a map of
 * { thingId -> { features, attributes, ...flat telemetry } }
 *
 * Ditto SSE endpoint:
 *   GET /api/2/things?fields=thingId,features,attributes
 *   Accept: text/event-stream
 */
export function useDittoSSE() {
  const [things, setThings]     = useState({})   // keyed by thingId
  const [connected, setConnected] = useState(false)
  const esRef = useRef(null)

  const merge = useCallback((thingId, patch) => {
    setThings(prev => ({
      ...prev,
      [thingId]: { ...(prev[thingId] || {}), ...patch }
    }))
  }, [])

  useEffect(() => {
    // Ditto SSE: subscribe to all things changes
    // fields param keeps the payload small
    const builder = new DittoQueryBuilder()
      .selectFields(['thingId', 'features', 'attributes'])
      .withParam('option', 'size(200)');
    
    const url = builder.buildUrl();

    // We rely on the Vite proxy adding auth, OR use custom fetch
    // Fallback: chiudiamo il native EventSource a favore del proxy ReadableStream


    // ── ReadableStream-based SSE (supports custom headers) ──────────────────
    let controller = new AbortController()

    // Helper to process payload into our flat state structure
    const processPayload = (payload) => {
      const thingId = payload.thingId
      if (!thingId) return
      
      const flat = {}
      const feats = payload.features || {}
      for (const [featName, featVal] of Object.entries(feats)) {
        const props = featVal?.properties || {}
        Object.assign(flat, props)
      }
      
      merge(thingId, {
        thingId,
        attributes: payload.attributes || {},
        features: feats,
        ...flat,
      })
    }

    const connect = async () => {
      try {
        // 1. Initial Snapshot Fetch
        // We fetch the current state so the dashboard isn't empty on F5
        const initialBuilder = new DittoQueryBuilder().selectFields(['thingId', 'features', 'attributes']);
        const initialRes = await fetch(initialBuilder.buildUrl(), {
          headers: { 'Authorization': DITTO_AUTH }
        })
        if (initialRes.ok) {
          const data = await initialRes.json()
          const items = Array.isArray(data) ? data : (data.items || [])
          items.forEach(processPayload)
        }

        // 2. Start SSE Stream
        const res = await fetch(url, {
          headers: {
            'Accept':        'text/event-stream',
            'Authorization': DITTO_AUTH,
          },
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          console.error('[SSE] Ditto unreachable, status:', res.status)
          setConnected(false)
          return
        }

        setConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() // keep incomplete line

          let eventType = 'message'
          let dataLines = []

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim())
            } else if (line === '') {
              // dispatch event
              if (dataLines.length) {
                try {
                  const payload = JSON.parse(dataLines.join('\n'))
                  processPayload(payload)
                } catch { /* skip malformed */ }
              }
              eventType = 'message'
              dataLines = []
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[SSE] disconnected, retry in 5s', err.message)
          setConnected(false)
          setTimeout(connect, 5000)
        }
      }
    }

    connect()
    esRef.current = controller

    return () => {
      controller.abort()
      setConnected(false)
    }
  }, [merge])

  return { things, connected }
}
