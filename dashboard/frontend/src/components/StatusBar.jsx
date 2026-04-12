import { SENSORS, getMetricColor } from '../data/sensors'

export default function StatusBar({ sensorData, connected }) {
  const allValues = Object.values(sensorData)

  const avg = (key) => {
    const vals = allValues.map(d => d[key]).filter(v => v != null)
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }

  const totalMotion = allValues.reduce((sum, d) => sum + (d.motion || 0), 0)
  const anomalies = allValues.filter(d => d.anomaly).length

  const metrics = [
    { label: "Temperatura",   value: avg('temperature'),  unit: "°C",  key: "temperature" },
    { label: "Umidità",       value: avg('humidity'),     unit: "%",   key: "humidity" },
    { label: "CO₂",           value: avg('air_quality'),  unit: "ppm", key: "air_quality" },
    { label: "Persone",       value: totalMotion || null, unit: "",    key: "motion" },
    { label: "Rumore",        value: avg('noise'),        unit: "dB",  key: "noise" },
  ]

  return (
    <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-8">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-400">{connected ? 'Live' : 'Disconnesso'}</span>
      </div>

      <div className="flex gap-6 flex-1">
        {metrics.map(m => (
          <div key={m.key} className="flex flex-col">
            <span className="text-xs text-slate-500">{m.label}</span>
            <span className={`text-sm font-semibold ${getMetricColor(m.key, parseFloat(m.value))}`}>
              {m.value != null ? `${m.value}${m.unit}` : '—'}
            </span>
          </div>
        ))}
      </div>

      {anomalies > 0 && (
        <div className="flex items-center gap-1 bg-red-900/50 border border-red-700 rounded px-2 py-1">
          <span className="text-red-400 text-xs font-bold">⚠ {anomalies} anomali{anomalies > 1 ? 'e' : 'a'}</span>
        </div>
      )}

      <div className="text-xs text-slate-500">
        {SENSORS.length} sensori attivi
      </div>
    </div>
  )
}
