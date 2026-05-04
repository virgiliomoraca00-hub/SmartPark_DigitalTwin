import { useState } from 'react'

const GRAFANA_BASE = 'http://localhost:3000'
const DASHBOARD_UID = 'smart-park-v1'
const DASHBOARD_SLUG = 'smart-park'

const TIME_RANGES = [
  { label: '30 min', value: 'now-30m' },
  { label: '1 ora',  value: 'now-1h'  },
  { label: '3 ore',  value: 'now-3h'  },
  { label: '6 ore',  value: 'now-6h'  },
  { label: '24 ore', value: 'now-24h' },
]

const SECTIONS = [
  {
    title: 'Condizioni Ambientali',
    icon: '🌿',
    panels: [
      { id: 10, title: 'Temperatura (°C)',   height: 320 },
      { id: 11, title: 'Umidità & CO₂',      height: 320 },
    ],
  },
  {
    title: 'Presenze & Comportamento',
    icon: '👥',
    panels: [
      { id: 13, title: 'Persone rilevate',   height: 320 },
      { id: 23, title: 'Sentiment Score',    height: 320 },
    ],
  },
  {
    title: 'Audio & Rumore',
    icon: '🔊',
    panels: [
      { id: 5,  title: 'Rumore Medio (dB)',  height: 320 },
      { id: 14, title: 'Rumore per Microfono', height: 320 },
    ],
  },
  {
    title: 'Wearable & Attività Fisica',
    icon: '❤️',
    panels: [
      { id: 33, title: 'Heart Rate',         height: 320 },
      { id: 31, title: 'Passi totali',       height: 320 },
    ],
  },
]

function grafanaUrl(panelId, from) {
  return `${GRAFANA_BASE}/d-solo/${DASHBOARD_UID}/${DASHBOARD_SLUG}?orgId=1&panelId=${panelId}&from=${from}&to=now&refresh=10s&theme=dark`
}

export default function AdvancedMonitoring({ onClose }) {
  const [timeRange, setTimeRange] = useState('now-1h')

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-950/97 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">📊</span>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Monitoraggio Avanzato</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">
              Riserva "Giganti della Sila" · Analisi storica
            </p>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest mr-2">Intervallo</span>
          {TIME_RANGES.map(tr => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                timeRange === tr.value
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${GRAFANA_BASE}/d/${DASHBOARD_UID}/${DASHBOARD_SLUG}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-all"
          >
            Grafana ↗
          </a>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white border border-slate-700/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-5">
              <span>{section.icon}</span>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                {section.title}
              </h3>
              <div className="flex-1 h-px bg-slate-800 ml-2" />
            </div>

            <div className={`grid gap-5 ${section.panels.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-3xl'}`}>
              {section.panels.map(panel => (
                <div
                  key={`${panel.id}-${timeRange}`}
                  className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900"
                >
                  <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {panel.title}
                    </span>
                    <span className="text-[9px] text-slate-700 font-mono">panel #{panel.id}</span>
                  </div>
                  <iframe
                    src={grafanaUrl(panel.id, timeRange)}
                    width="100%"
                    height={panel.height}
                    style={{ border: 'none' }}
                    title={panel.title}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-[9px] text-slate-700 uppercase tracking-widest pb-4">
          Dati da InfluxDB via Grafana · aggiornamento ogni 10s
        </p>
      </div>
    </div>
  )
}
