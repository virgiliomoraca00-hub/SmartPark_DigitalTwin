/**
 * thingSchema.js — Derivazione Schema Dinamico dai Things Ditto
 *
 * Trasforma il dizionario sseThings (thingId → Thing) in uno schema
 * navigabile a 3 livelli usato dall'albero filtri di AdvancedMonitoring:
 *
 *   schema = {
 *     [type]: {
 *       [zone]: {
 *         [thingId]: {
 *           label: string,          // nome leggibile
 *           thingId: string,
 *           type: string,
 *           zone: string,
 *           lat: number | null,
 *           lng: number | null,
 *           metrics: string[],      // es. ['temperature_c', 'humidity_pct']
 *         }
 *       }
 *     }
 *   }
 *
 * I nomi delle metriche sono normalizzati: il prefisso "data_" viene rimosso
 * per la UI, ma mantenuto nelle query InfluxDB.
 */

import { assignZone, computeBoundingBox } from './zoneConfig'

// Campi da escludere dalle metriche (metadati, non dati graficabili)
const EXCLUDED_KEYS = new Set([
  'lat', 'lng', 'timestamp', 'device_id', 'type',
  'name', 'zone', 'activity', 'location',
])

// Icone per tipo di sensore
export const TYPE_ICONS = {
  environmental:      '🌿',
  audio:              '🔊',
  sentimentAnalysis:  '😊',
  vision:             '📷',
  activityRecognition:'❤️',
  parking:            '🅿️',
  weather:            '🌤️',
  soil:               '🌱',
}

// Label leggibili per tipo di sensore
export const TYPE_LABELS = {
  environmental:      'Ambientale',
  audio:              'Audio / Rumore',
  sentimentAnalysis:  'Sentiment',
  vision:             'Vision / Camera',
  activityRecognition:'Wearable',
  parking:            'Parcheggio',
  weather:            'Meteo',
  soil:               'Suolo',
}

/**
 * Estrae le metriche graficabili da un Thing.
 * Le cerca in features.sensors.properties, escludendo chiavi non numeriche
 * o chiavi di metadati.
 *
 * @param {Object} thing
 * @returns {string[]} Array di nomi metrica normalizzati (senza prefisso data_)
 */
function extractMetrics(thing) {
  const props = thing.features?.sensors?.properties ?? {}
  return Object.entries(props)
    .filter(([key, val]) => {
      if (EXCLUDED_KEYS.has(key)) return false
      if (typeof val !== 'number') return false
      return true
    })
    .map(([key]) => key.replace(/^data_/, ''))  // strip data_ prefix per UI
    .sort()
}

/**
 * Deriva lo schema completo a 3 livelli da sseThings.
 *
 * @param {Object} sseThings - Dizionario { thingId: Thing } dal hook useDittoSSE
 * @returns {Object} Schema { [type]: { [zone]: { [thingId]: ThingInfo } } }
 */
export function deriveSchema(sseThings) {
  const things = Object.values(sseThings)
  if (things.length === 0) return {}

  const bbox = computeBoundingBox(things)
  const schema = {}

  for (const thing of things) {
    const type  = thing.attributes?.type ?? 'unknown'
    const lat   = thing.attributes?.lat  ?? thing.features?.sensors?.properties?.lat ?? null
    const lng   = thing.attributes?.lng  ?? thing.features?.sensors?.properties?.lng ?? null
    const zone  = assignZone(lat, lng, bbox)
    const metrics = extractMetrics(thing)

    // Skip Things senza metriche graficabili
    if (metrics.length === 0) continue

    const deviceId = thing.thingId.split(':')[1] ?? thing.thingId
    const label    = thing.attributes?.name ?? deviceId

    if (!schema[type]) schema[type] = {}
    if (!schema[type][zone]) schema[type][zone] = {}

    schema[type][zone][thing.thingId] = {
      label,
      thingId: thing.thingId,
      deviceId,
      type,
      zone,
      lat,
      lng,
      metrics,
    }
  }

  return schema
}

/**
 * Restituisce il nome del field InfluxDB dato il nome metrica normalizzato.
 * Aggiunge il prefisso "data_" se non presente.
 * Es. 'temperature_c' → 'data_temperature_c'
 *     'data_humidity_pct' → 'data_humidity_pct'
 */
export function toInfluxField(metricName) {
  return metricName.startsWith('data_') ? metricName : `data_${metricName}`
}

/**
 * Conta il totale di Things e metriche nello schema.
 */
export function schemaStats(schema) {
  let things  = 0
  let metrics = 0
  for (const zones of Object.values(schema)) {
    for (const items of Object.values(zones)) {
      for (const item of Object.values(items)) {
        things++
        metrics += item.metrics.length
      }
    }
  }
  return { things, metrics }
}
