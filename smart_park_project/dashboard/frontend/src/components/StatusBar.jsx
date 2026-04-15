import { getMetricColor } from '../data/sensors'

export default function StatusBar({ sseThings = {}, connected, totalPins = 0 }) {
  const allValues = Object.values(sseThings)

  // Funzione helper per le medie (accetta array di chiavi per compatibilità coi nomi vecchi/nuovi)
  const avg = (keys) => {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    
    // Trova il primo valore numerico valido tra le chiavi fornite per questo sensore
    const vals = allValues.map(d => {
      for (let key of keyArray) {
        if (typeof d[key] === 'number') return d[key]
      }
      return null
    }).filter(v => v !== null)

    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }

  // Helper per somme totali
  const sum = (keys) => {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    let total = 0;
    allValues.forEach(d => {
      for (let key of keyArray) {
        if (typeof d[key] === 'number') {
          total += d[key]
          break // Usa solo il primo che matcha
        }
      }
    })
    return total
  }

  const totalMotion = sum(['person_count', 'motion', 'activity'])
  const anomalies = allValues.filter(d => d.anomaly || d.anomaly_detected).length

  const metrics = [
    { label: "Temperatura", value: avg(['temperature', 'temperature_c']), unit: "°C", key: "temperature" },
    { label: "Umidità", value: avg(['humidity', 'humidity_pct']), unit: "%", key: "humidity" },
    { label: "CO₂", value: avg(['co2_ppm', 'air_quality']), unit: "ppm", key: "air_quality" },
    { label: "Persone", value: totalMotion || null, unit: "", key: "motion" },
    { label: "Rumore", value: avg('noise'), unit: "dB", key: "noise" },
  ]

  return (
    <div className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center gap-8 shadow-xl relative z-20">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-400 font-medium tracking-wider uppercase">{connected ? 'Live Data' : 'Disconnesso'}</span>
      </div>

      <div className="flex gap-8 flex-1 border-l border-slate-800 pl-8">
        {metrics.map(m => (
          <div key={m.key} className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{m.label}</span>
            <span className={`text-sm font-black ${getMetricColor(m.key, parseFloat(m.value))}`}>
              {m.value != null ? `${m.value}${m.unit}` : '—'}
            </span>
          </div>
        ))}
      </div>

      {anomalies > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse">
          <span className="text-red-400 text-[10px] font-black uppercase tracking-wider">⚠ {anomalies} Anomali{anomalies > 1 ? 'e' : 'a'}</span>
        </div>
      )}

      <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase border-l border-slate-800 pl-6">
        {allValues.length} / {totalPins} ONLINE
      </div>
    </div>
  )
}
