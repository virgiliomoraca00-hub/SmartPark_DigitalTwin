// Sensori virtuali con posizione percentuale sull'SVG (x%, y%)
// viewBox del SVG: 0 0 297 297
// Le coordinate sono in percentuale rispetto alle dimensioni del contenitore

/**
 * Mappa feature Ditto → tipo sensore UI
 * Chiave = nome feature (come arriva da Ditto)
 */
export const FEATURE_TYPE_MAP = {
  environment: 'environmental',
  environment_data: 'environmental',
  sentimentAnalysis: 'sentiment',
  sentiment: 'sentiment',
  activityRecognition: 'wearable',
  activity: 'wearable',
  computerVision: 'vision',
  vision: 'vision',
}

/**
 * Config per tipo sensore: label, icona emoji, colore marker leaflet, tailwind color class
 */
export const TYPE_CONFIG = {
  environmental: { label: 'Ambientale', icon: '🌿', markerColor: '#22d3ee', colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/10', borderClass: 'border-cyan-500/30' },
  vision: { label: 'Visione', icon: '👁', markerColor: '#a78bfa', colorClass: 'text-violet-400', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/30' },
  sentiment: { label: 'Sentiment', icon: '🎙', markerColor: '#fb923c', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/30' },
  wearable: { label: 'Wearable', icon: '⌚', markerColor: '#34d399', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/30' },
  unknown: { label: 'Sconosciuto', icon: '📡', markerColor: '#64748b', colorClass: 'text-slate-400', bgClass: 'bg-slate-700/40', borderClass: 'border-slate-600/30' },
}

/** Risolve tipo dal sseThings entry (cerca prima feature key, poi fallback) */
export function resolveTypeFromThing(thingData) {
  if (!thingData?.features) return 'unknown'
  const featureKey = Object.keys(thingData.features)[0]
  return FEATURE_TYPE_MAP[featureKey] || 'unknown'
}


export const ZONE_LABELS = {
  nord: "Zona Nord",
  centro: "Zona Centro",
  sud: "Zona Sud",
}

export const METRIC_THRESHOLDS = {
  temperature: { green: 25, yellow: 35 },
  humidity: { green: 75, yellow: 30 },
  air_quality: { green: 600, yellow: 800 },
  motion: { green: 20, yellow: 40 },
  noise: { green: 60, yellow: 75 },
}

export function getMetricColor(metric, value) {
  const t = METRIC_THRESHOLDS[metric]
  if (!t) return "text-slate-400"
  if (metric === "humidity") {
    if (value >= 30 && value <= 75) return "text-green-400"
    if (value > 75) return "text-yellow-400"
    return "text-red-400"
  }
  if (value < t.green) return "text-green-400"
  if (value < t.yellow) return "text-yellow-400"
  return "text-red-400"
}

export function getSensorColor(sensorData) {
  if (!sensorData) return "#64748b"
  if (sensorData.anomaly) return "#ef4444"
  if (sensorData.air_quality > 800 || sensorData.noise > 75 || sensorData.motion > 40) return "#f59e0b"
  return "#22c55e"
}
