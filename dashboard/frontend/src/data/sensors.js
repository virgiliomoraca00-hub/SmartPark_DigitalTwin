// Sensori virtuali con posizione percentuale sull'SVG (x%, y%)
// viewBox del SVG: 0 0 297 297
// Le coordinate sono in percentuale rispetto alle dimensioni del contenitore

export const SENSORS = [
  { id: "sensor-entrance",    name: "Ingresso Principale",  x: 52, y: 82, zone: "sud"    },
  { id: "sensor-lake",        name: "Area Lago",            x: 52, y: 45, zone: "centro" },
  { id: "sensor-playground",  name: "Area Giochi",          x: 62, y: 65, zone: "centro" },
  { id: "sensor-north-1",     name: "Sentiero Nord",        x: 43, y: 15, zone: "nord"   },
  { id: "sensor-north-2",     name: "Bosco Nord-Est",       x: 52, y: 25, zone: "nord"   },
  { id: "sensor-west",        name: "Area Ovest",           x: 40, y: 48, zone: "centro" },
  { id: "sensor-east",        name: "Area Est",             x: 62, y: 37, zone: "centro" },
  { id: "sensor-south-1",     name: "Picnic Sud",           x: 56, y: 75, zone: "sud"    },
  { id: "sensor-south-2",     name: "Parcheggio Sud",       x: 65, y: 86, zone: "sud"    },
  { id: "sensor-center",      name: "Centro Parco",         x: 52, y: 55, zone: "centro" },
]

export const ZONE_LABELS = {
  nord:   "Zona Nord",
  centro: "Zona Centro",
  sud:    "Zona Sud",
}

export const METRIC_THRESHOLDS = {
  temperature: { green: 25, yellow: 35 },
  humidity:    { green: 75, yellow: 30 },
  air_quality: { green: 600, yellow: 800 },
  motion:      { green: 20, yellow: 40 },
  noise:       { green: 60, yellow: 75 },
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
