/**
 * zoneConfig.js — Configurazione Zone Semantiche del Parco
 *
 * Definisci qui le zone reali del parco con nome leggibile e coordinate centrali.
 * Ogni sensore viene assegnato automaticamente alla zona più vicina in base a lat/lng.
 *
 * Se ZONES è vuoto [] → si usa il Geo-Grid automatico (celle NW/N/NE/SW/S/SE).
 * Se ZONES ha voci    → si usa la zona semantica più vicina (distanza euclidea).
 *
 * Per personalizzare: aggiungi/modifica le voci in ZONES con le coordinate reali del parco.
 * Il campo `radius` è opzionale e non usato nel matching (usato solo per visualizzazione futura).
 */

export const ZONES = [
  // ── MODALITÀ ATTIVA: Geo-Grid automatico ─────────────────────────────────
  // ZONES è vuoto → assignZone usa la griglia geografica adattiva (NW/N/NE/SW/S/SE)
  // calcolata sul bounding box reale dei sensori presenti nel sistema.
  //
  // Per attivare le zone semantiche, decommenta le righe qui sotto
  // inserendo le coordinate GPS reali delle aree del parco:
  //
  // { id: 'entrance',   label: 'Ingresso',      lat: 39.3208, lng: 16.4695, radius: 0.0008 },
  // { id: 'trail_n',    label: 'Sentiero Nord',  lat: 39.3218, lng: 16.4700, radius: 0.0010 },
  // { id: 'giganti',    label: 'Area Giganti',   lat: 39.3224, lng: 16.4710, radius: 0.0012 },
  // { id: 'trail_e',    label: 'Sentiero Est',   lat: 39.3220, lng: 16.4722, radius: 0.0010 },
  // { id: 'trail_s',    label: 'Sentiero Sud',   lat: 39.3210, lng: 16.4715, radius: 0.0008 },
  // { id: 'rest_area',  label: 'Area Sosta',     lat: 39.3212, lng: 16.4702, radius: 0.0007 },
  // ─────────────────────────────────────────────────────────────────────────
]

// ── Labels Geo-Grid automatico (3 colonne × 2 righe = 6 celle) ─────────────
export const GRID_LABELS = [
  ['Zona NW', 'Zona N', 'Zona NE'],  // riga 0 = Nord (lat alta)
  ['Zona SW', 'Zona S', 'Zona SE'],  // riga 1 = Sud  (lat bassa)
]

/**
 * Calcola la distanza euclidea tra due coordinate lat/lng.
 * Sufficiente per confronti di prossimità su piccola scala (parco).
 */
function euclideanDist(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2)
}

/**
 * Assegna un sensore a una zona basandosi su lat/lng.
 *
 * Strategia:
 *  1. Se ZONES ha voci → zona semantica più vicina (distanza euclidea)
 *  2. Se ZONES è vuoto → cella geo-grid (NW, N, NE, SW, S, SE)
 *     calcolata normalizzando rispetto al bounding box di tutti i sensori.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {{ minLat: number, maxLat: number, minLng: number, maxLng: number } | null} bbox
 *   Bounding box di tutti i sensori (necessario per geo-grid, ignorato per POI).
 * @returns {string} Label della zona
 */
export function assignZone(lat, lng, bbox = null) {
  if (lat == null || lng == null) return 'Posizione sconosciuta'

  // ── Strategia POI semantica ─────────────────────────────────────────────
  if (ZONES.length > 0) {
    let nearest = ZONES[0]
    let minDist = euclideanDist(lat, lng, ZONES[0].lat, ZONES[0].lng)
    for (let i = 1; i < ZONES.length; i++) {
      const d = euclideanDist(lat, lng, ZONES[i].lat, ZONES[i].lng)
      if (d < minDist) { minDist = d; nearest = ZONES[i] }
    }
    return nearest.label
  }

  // ── Strategia Geo-Grid automatica ───────────────────────────────────────
  if (!bbox) return 'Zona Sconosciuta'

  const { minLat, maxLat, minLng, maxLng } = bbox
  const latRange = maxLat - minLat || 0.001
  const lngRange = maxLng - minLng || 0.001

  // Normalizza in [0, 1]
  const normLat = (lat - minLat) / latRange   // 0 = Sud, 1 = Nord
  const normLng = (lng - minLng) / lngRange   // 0 = Ovest, 1 = Est

  // Row: 0 = Nord (alta lat), 1 = Sud (bassa lat)
  const row = normLat >= 0.5 ? 0 : 1
  // Col: 0 = Ovest, 1 = Centro, 2 = Est
  const col = normLng < 0.33 ? 0 : normLng < 0.67 ? 1 : 2

  return GRID_LABELS[row][col]
}

/**
 * Calcola il bounding box di un array di Things.
 * @param {Object[]} things - Array di Things con lat/lng in attributes o features
 * @returns {{ minLat, maxLat, minLng, maxLng } | null}
 */
export function computeBoundingBox(things) {
  const coords = things
    .map(t => ({
      lat: t.attributes?.lat ?? t.features?.sensors?.properties?.lat,
      lng: t.attributes?.lng ?? t.features?.sensors?.properties?.lng,
    }))
    .filter(c => c.lat != null && c.lng != null)

  if (coords.length === 0) return null

  return {
    minLat: Math.min(...coords.map(c => c.lat)),
    maxLat: Math.max(...coords.map(c => c.lat)),
    minLng: Math.min(...coords.map(c => c.lng)),
    maxLng: Math.max(...coords.map(c => c.lng)),
  }
}
