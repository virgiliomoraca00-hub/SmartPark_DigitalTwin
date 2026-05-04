const SENTIMENT_CONFIG = {
  positive: { label: 'Positivo', color: 'text-green-400', bar: 'bg-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  neutral:  { label: 'Neutro',   color: 'text-yellow-400', bar: 'bg-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  negative: { label: 'Negativo', color: 'text-red-400',    bar: 'bg-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
}

export default function SentimentPopup({ audioSensors = [], onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[50]" onClick={onClose} />

      {/* Popup */}
      <div className="fixed top-16 right-4 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-[51] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-base">🎤</span>
            <h3 className="text-sm font-bold text-white tracking-tight">Sentiment Microfoni</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
          {audioSensors.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">Nessun microfono online</div>
          ) : (
            audioSensors.map(sensor => {
              const score = typeof sensor.sentiment_score === 'number' ? sensor.sentiment_score : null
              const derivedSentiment = score !== null
                ? (score > 0.3 ? 'positive' : score < -0.3 ? 'negative' : 'neutral')
                : (sensor.sentiment || null)
              const cfg = derivedSentiment ? SENTIMENT_CONFIG[derivedSentiment] : null
              const name = sensor.attributes?.name || sensor.thingId?.split(':')[1] || sensor.thingId

              return (
                <div key={sensor.thingId} className="p-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${cfg?.bg || 'bg-slate-800'} border ${cfg?.border || 'border-slate-700'}`}>
                    🎤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{name}</p>
                    {cfg ? (
                      <>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</p>
                        {score !== null && (
                          <div className="mt-1 h-1 bg-slate-700/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                              style={{ width: `${((score + 1) / 2 * 100).toFixed(0)}%` }}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-500">Nessun dato</p>
                    )}
                  </div>
                  {score !== null && (
                    <span className={`text-xs font-black shrink-0 tabular-nums ${cfg?.color || 'text-slate-500'}`}>
                      {score > 0 ? '+' : ''}{score.toFixed(2)}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 text-[9px] text-slate-600 text-center uppercase tracking-widest">
          Dati in tempo reale · SSE
        </div>
      </div>
    </>
  )
}
