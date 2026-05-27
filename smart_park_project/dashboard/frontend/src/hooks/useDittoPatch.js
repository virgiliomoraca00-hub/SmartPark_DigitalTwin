// useDittoPatch.js — invia PATCH a Ditto per modificare una desiredProperty
import { useCallback, useState } from 'react'

const DITTO_BASE = 'http://localhost:8080/api/2'
const DITTO_AUTH = 'Basic ' + btoa('ditto:ditto')

/**
 * Restituisce una funzione `patchDesired(thingId, key, value)` che scrive
 * una desiredProperty nel Digital Twin via Ditto REST API (MERGE/PATCH).
 * 
 * Ditto poi emette un evento MQTT su smartpark/events/<thingId>
 * che Node-RED intercetta per aggiornare il suo stato interno.
 */
export function useDittoPatch() {
  const [pending, setPending] = useState({}) // { [thingId_key]: 'saving' | 'ok' | 'error' }

  const patchDesired = useCallback(async (thingId, key, value) => {
    const pendingKey = `${thingId}_${key}`
    setPending(p => ({ ...p, [pendingKey]: 'saving' }))

    // Il path Ditto per desiredProperties: /features/sensors/desiredProperties/<key>
    const url = `${DITTO_BASE}/things/${thingId}/features/sensors/desiredProperties/${key}`

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': DITTO_AUTH,
        },
        body: JSON.stringify(value),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPending(p => ({ ...p, [pendingKey]: 'ok' }))
      setTimeout(() => setPending(p => { const n = { ...p }; delete n[pendingKey]; return n }), 2000)
    } catch (err) {
      console.error('[useDittoPatch] Errore:', err)
      setPending(p => ({ ...p, [pendingKey]: 'error' }))
      setTimeout(() => setPending(p => { const n = { ...p }; delete n[pendingKey]; return n }), 3000)
    }
  }, [])

  const getState = useCallback((thingId, key) => {
    return pending[`${thingId}_${key}`] || null
  }, [pending])

  return { patchDesired, getState }
}
