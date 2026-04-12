import { useEffect, useState } from 'react'

const ZONES = ['nord', 'centro', 'sud']

const ZONE_LABELS = { nord: 'Zona Nord', centro: 'Zona Centro', sud: 'Zona Sud' }

const SENTIMENT_CONFIG = {
  positive: { label: 'Positivo', color: 'text-green-400', bg: 'bg-green-900/30', bar: 'bg-green-500' },
  neutral:  { label: 'Neutro',   color: 'text-yellow-400', bg: 'bg-yellow-900/30', bar: 'bg-yellow-500' },
  negative: { label: 'Negativo', color: 'text-red-400',   bg: 'bg-red-900/30',   bar: 'bg-red-500' },
}

export default function SentimentPanel() {
  const [data, setData] = useState({})
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchSentiment = () => {
    fetch('/api/sentiment/latest')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLastUpdate(new Date())
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchSentiment()
    const interval = setInterval(fetchSentiment, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-slate-900 border-t border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Analisi Sentiment</h3>
        <span className="text-xs text-slate-500">
          {lastUpdate ? `Agg. ${lastUpdate.toLocaleTimeString('it-IT')}` : 'In attesa...'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ZONES.map(zone => {
          const zoneData = data[zone]
          const cfg = zoneData ? SENTIMENT_CONFIG[zoneData.sentiment] : null

          return (
            <div key={zone} className={`rounded-lg p-3 border border-slate-700 ${cfg?.bg || 'bg-slate-800'}`}>
              <p className="text-xs text-slate-400 mb-1">{ZONE_LABELS[zone]}</p>

              {zoneData ? (
                <>
                  <p className={`text-sm font-bold ${cfg?.color}`}>{cfg?.label}</p>

                  {/* Barra score */}
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cfg?.bar}`}
                      style={{ width: `${(zoneData.score * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{(zoneData.score * 100).toFixed(0)}% confidenza</p>

                  {zoneData.action && (
                    <p className="text-xs text-slate-400 mt-1.5 truncate" title={zoneData.action}>
                      {zoneData.action}
                    </p>
                  )}

                  {zoneData.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{zoneData.description}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-600 mt-1">Nessun dato</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
