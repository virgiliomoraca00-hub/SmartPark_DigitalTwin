import { getTypeConfig, getTelemetryMeta } from '../config/sensorConfig'

const GRAFANA_BASE = 'http://localhost:3000'
const DASHBOARD_UID = 'smart-park-dynamic'
const DASHBOARD_SLUG = 'smart-park-dynamic'

// "smartpark:cam-202" → "cam-202"
function extractDeviceId(thingId) {
  if (!thingId) return ''
  const colon = thingId.indexOf(':')
  return colon !== -1 ? thingId.slice(colon + 1) : thingId
}

// Calcola quanto tempo è passato dall'ultimo aggiornamento
function timeAgo(dateString) {
  if (!dateString) return 'Sconosciuto'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Non valido'

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Pochi secondi fa'
  if (diffMin < 60) return `${diffMin} min fa`
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'ora' : 'ore'} fa`
  return `${diffDay} ${diffDay === 1 ? 'giorno' : 'giorni'} fa`
}

// Verifica se il sensore è offline (nessun dato da > 1 ora)
function isSensorOffline(dateString) {
  if (!dateString) return false // se non c'è timestamp, non lo dichiariamo offline a prescindere
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return false
  return (Date.now() - date.getTime()) > (60 * 60 * 1000) // 1 ora in millisecondi
}

export default function SensorPanel({ sensorInfo, liveData, connected, onClose, onOpenAdvanced }) {
  const thingId = sensorInfo?.thingId || sensorInfo?.id
  const deviceId = extractDeviceId(thingId)

  if (!sensorInfo) return null

  const data = liveData || sensorInfo
  const typeConfig = getTypeConfig(data.attributes?.type)
  const sensorType = data.attributes?.type
  const telemetryData = data.features?.sensors?.properties || data.attributes || {}

  const hasAnomaly = telemetryData.anomaly_detected || data.anomaly || false
  
  // Trova il timestamp dal payload flattato o dalle properties
  const timestamp = data.timestamp || telemetryData.timestamp
  const lastUpdateStr = timeAgo(timestamp)
  const isStale = isSensorOffline(timestamp)
  const isActuallyConnected = connected && !isStale

  // Formatta l'orario assoluto
  let exactTimeStr = ''
  if (timestamp) {
    const date = new Date(timestamp)
    if (!isNaN(date.getTime())) {
      exactTimeStr = date.toLocaleString('it-IT', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      })
    }
  }

  const displayMetrics = Object.entries(telemetryData).filter(([key]) => key !== 'lat' && key !== 'lng')

  const displayAttributes = Object.entries(data.attributes || {}).filter(([key]) =>
    key !== 'lat' && key !== 'lng' && key !== 'type' && !telemetryData.hasOwnProperty(key)
  )

  return (
    <div
      className="flex flex-col h-full bg-slate-900 border-l border-slate-700 overflow-hidden"
      style={{ borderTop: `4px solid ${typeConfig.color}` }}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{typeConfig.mapMarkerIcon}</span>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">
              {sensorInfo.name || typeConfig.label}
            </h2>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
              ID: {thingId}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white"
          title="Chiudi"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content — vertical layout */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 space-y-6">

          {/* Status badges */}
          <div className="flex items-start gap-3 flex-wrap">
            <div className={`mt-0.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
              isActuallyConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActuallyConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isActuallyConnected ? 'Live SSE' : (isStale ? 'Stale / Offline' : 'Offline')}
            </div>
            {hasAnomaly && (
              <div className="mt-0.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                ⚠ Anomalia
              </div>
            )}
            
            {/* Last Update Badge in risalto con data/ora assoluta */}
            <div className="ml-auto flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] bg-slate-800/80 border border-slate-700 font-bold">
                <span className="text-slate-400">⏱ Aggiornato:</span>
                <span className={isStale ? "text-amber-400" : "text-sky-400"}>{lastUpdateStr}</span>
              </div>
              {exactTimeStr && (
                <div className="text-[10px] text-slate-500 font-mono pr-2">
                  {exactTimeStr}
                </div>
              )}
            </div>
          </div>

          {/* Real-time metrics — 2 columns */}
          {displayMetrics.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Misure Real-Time</h3>
              <div className="grid grid-cols-2 gap-2">
                {displayMetrics.map(([key, value]) => {
                  const meta = getTelemetryMeta(key)
                  const displayValue = typeof value === 'boolean' ? (value ? 'Sì' : 'No') : value
                  const isNumber = typeof value === 'number'
                  return (
                    <div key={key} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 flex items-center gap-3">
                      <div className="text-xl bg-slate-800 p-1.5 rounded-lg border border-slate-700/50 shrink-0">
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 truncate">{meta.label}</div>
                        <div className="mt-0.5">
                          <span
                            className="text-base font-black"
                            style={meta.color ? { color: meta.color } : { color: isNumber ? '#818cf8' : '#e2e8f0' }}
                          >
                            {isNumber && !Number.isInteger(value) ? value.toFixed(2) : displayValue}
                          </span>
                          {meta.unit && (
                            <span className="text-[9px] text-slate-500 ml-1 font-bold">{meta.unit}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Base attributes */}
          {displayAttributes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Informazioni Base</h3>
              <div className="bg-slate-800/30 rounded-none border border-slate-700/30 overflow-hidden divide-y divide-slate-800/50">
                {displayAttributes.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-3 text-xs">
                    <span className="text-slate-400 font-medium capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-slate-200 font-mono text-[11px]">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deep link — Monitoraggio Avanzato */}
          <div className="space-y-3 pt-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Analisi Storica</h3>

            {/* Bottone principale */}
            <button
              onClick={() => onOpenAdvanced?.(thingId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all group"
            >
              <span className="text-2xl">📊</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                  Analisi Storica Avanzata
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Apre il monitoraggio dinamico filtrato su questo sensore
                </div>
              </div>
              <svg className="w-4 h-4 text-emerald-500/60 group-hover:text-emerald-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Link secondario Grafana completo */}
            <a
              href={`${GRAFANA_BASE}/d/${DASHBOARD_UID}/${DASHBOARD_SLUG}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 transition-all"
            >
              <span>📈</span>
              <span>Apri Grafana Dashboard completa</span>
              <span className="ml-auto opacity-60">↗</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}
