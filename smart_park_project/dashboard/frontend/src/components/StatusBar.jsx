import { getMetricColor } from '../data/sensors'

const SENTIMENT_CFG = {
  positive: { label: 'Positivo', emoji: '😊', color: 'text-green-300',  bg: 'bg-green-500/15',  border: 'border-green-400/30' },
  neutral:  { label: 'Neutro',   emoji: '😐', color: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-400/30' },
  negative: { label: 'Negativo', emoji: '😟', color: 'text-red-300',    bg: 'bg-red-500/15',    border: 'border-red-400/30'   },
}

export default function StatusBar({ sseThings = {}, connected, totalPins = 0, onSentimentToggle, sentimentOpen, onAdvancedToggle, advancedOpen }) {
  const allValues = Object.values(sseThings)

  const avg = (keys) => {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    const vals = allValues.map(d => {
      for (let key of keyArray) {
        if (typeof d[key] === 'number') return d[key]
      }
      return null
    }).filter(v => v !== null)
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }

  const sum = (keys) => {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    let total = 0
    allValues.forEach(d => {
      for (let key of keyArray) {
        if (typeof d[key] === 'number') { total += d[key]; break }
      }
    })
    return total
  }

  const totalMotion = sum(['person_count', 'motion', 'activity'])
  const anomalies = allValues.filter(d => d.anomaly || d.anomaly_detected).length

  const metrics = [
    { label: "Temperatura", value: avg(['temperature', 'temperature_c']), unit: "°C", key: "temperature" },
    { label: "Umidità",     value: avg(['humidity', 'humidity_pct']),     unit: "%",  key: "humidity" },
    { label: "CO₂",        value: avg(['co2_ppm', 'air_quality']),        unit: "ppm", key: "air_quality" },
    { label: "Persone",    value: totalMotion || null,                    unit: "",   key: "motion" },
    { label: "Rumore",     value: avg(['noise', 'noise_db']),             unit: "dB", key: "noise" },
  ]

  // Compute aggregate sentiment from audio/sentimentAnalysis sensors
  const audioSensors = allValues.filter(d =>
    d.attributes?.type === 'audio' || d.attributes?.type === 'sentimentAnalysis'
  )
  const scoredSensors = audioSensors.filter(d => typeof d.sentiment_score === 'number')
  let dominant = null
  let dominantPct = 0
  if (scoredSensors.length > 0) {
    const avgScore = scoredSensors.reduce((acc, d) => acc + d.sentiment_score, 0) / scoredSensors.length
    dominant = avgScore > 0.3 ? 'positive' : avgScore < -0.3 ? 'negative' : 'neutral'
    dominantPct = Math.round((avgScore + 1) / 2 * 100)
  }
  const sentCfg = dominant ? SENTIMENT_CFG[dominant] : null

  return (
    <div className="bg-slate-900 border-b border-slate-700 px-6 py-7 flex items-center gap-6 shadow-xl relative z-20">
      {/* Advanced monitoring button — centered absolutely */}
      <button
        onClick={onAdvancedToggle}
        className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2.5 rounded-lg border transition-all text-sm font-bold uppercase tracking-wider ${
          advancedOpen
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'bg-slate-800/60 border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-500'
        }`}
      >
        Monitoraggio Avanzato
      </button>
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
          {connected ? 'Live Data' : 'Disconnesso'}
        </span>
      </div>

      {/* Aggregated metrics */}
      <div className="flex gap-8 flex-1 border-l border-slate-800 pl-6">
        {metrics.map(m => (
          <div key={m.key} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{m.label}</span>
            <span className={`text-base font-black ${getMetricColor(m.key, parseFloat(m.value))}`}>
              {m.value != null ? `${m.value}${m.unit}` : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Anomaly indicator */}
      {anomalies > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1.5 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse">
          <span className="text-red-400 text-[10px] font-black uppercase tracking-wider">
            ⚠ {anomalies} Anomali{anomalies > 1 ? 'e' : 'a'}
          </span>
        </div>
      )}

      {/* Sentiment button */}
      <button
        onClick={onSentimentToggle}
        className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-all hover:brightness-110 active:scale-95 ${
          sentimentOpen
            ? 'bg-violet-500/20 border-violet-400/40 text-violet-200'
            : sentCfg
              ? `${sentCfg.bg} ${sentCfg.border} ${sentCfg.color}`
              : 'bg-slate-800/80 border-slate-600/50 text-slate-400'
        }`}
      >
        {/* Emoji cambia in base al sentiment */}
        <span className="text-xl leading-none">
          {sentimentOpen ? '💬' : sentCfg ? sentCfg.emoji : '🎙️'}
        </span>

        {/* Label + valore */}
        <div className="flex flex-col items-start leading-none min-w-[110px]">
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Sentiment</span>
          {sentCfg ? (
            <span className="flex items-baseline gap-3 mt-0.5">
              <span className="text-sm font-black">{sentCfg.label}</span>
              <span className="text-xs font-bold opacity-75">{dominantPct}%</span>
            </span>
          ) : (
            <span className="text-sm font-black mt-0.5 opacity-40">Nessun dato</span>
          )}
        </div>
      </button>

      {/* Online count */}
      <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase border-l border-slate-800 pl-6">
        {allValues.length} / {totalPins} ONLINE
      </div>
    </div>
  )
}
