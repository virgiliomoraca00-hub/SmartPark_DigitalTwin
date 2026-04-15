import { useEffect, useState } from 'react'

const DITTO_AUTH = 'Basic ' + btoa('ditto:ditto')

/**
 * Fetches a Thing Description (TD) from Ditto for a given thingId.
 * Uses Accept: application/td+json as per WoT spec.
 * Returns { td, loading, error }
 * td shape: { properties: {}, actions: {}, ... }
 */
export function useSensorTD(thingId) {
  const [td, setTd]         = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!thingId) return

    setLoading(true)
    setTd(null)
    setError(null)

    // Fetch the raw Ditto Thing (same approach as App.jsx and useDittoSSE)
    // WoT td+json is not required — we synthesise the TD locally from features/attributes
    const encoded = encodeURIComponent(thingId)
    fetch(`/ditto/2/things/${encoded}`, {
      headers: {
        'Authorization': DITTO_AUTH,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        // Always synthesise TD from raw Ditto Thing structure
        setTd(synthesiseTD(data))
      })
      .catch(err => {
        console.error('[TD] fetch failed:', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [thingId])

  return { td, loading, error }
}

/**
 * Fallback: build a minimal WoT-like TD from a raw Ditto Thing JSON.
 * Maps each feature's properties to TD properties.
 */
function synthesiseTD(thing) {
  const properties = {}
  const actions    = {}

  // Attributes → read-only properties
  for (const [key, val] of Object.entries(thing.attributes || {})) {
    if (key === 'lat' || key === 'lng') continue // skip coords from panel
    properties[key] = {
      title:    key,
      type:     typeof val === 'number' ? 'number' : 'string',
      readOnly: true,
      'ditto:source': 'attribute',
    }
  }

  // Features → properties
  for (const [featName, featVal] of Object.entries(thing.features || {})) {
    for (const [propKey, propVal] of Object.entries(featVal?.properties || {})) {
      properties[`${featName}/${propKey}`] = {
        title:    propKey,
        feature:  featName,
        type:     typeof propVal === 'number' ? 'number'
                : typeof propVal === 'boolean' ? 'boolean'
                : 'string',
        readOnly: true,
        'ditto:source': 'feature',
      }
    }
  }

  return { title: thing.thingId, properties, actions }
}
