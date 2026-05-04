import { getTypeConfig, getTelemetryMeta } from '../config/sensorConfig'

const GRAFANA_BASE = 'http://localhost:3000'
const DASHBOARD_UID = 'smart-park-v1'
const DASHBOARD_SLUG = 'smart-park'
const TIME_PARAMS = 'from=now-30m&to=now&refresh=5s&theme=dark'

const GRAFANA_PANELS = {
  environmental: [
    { id: 10, title: 'Temperatura (°C)', height: 220 },
    { id: 11, title: 'Umidità & CO₂', height: 220 },
  ],
  vision: [
    { id: 13, title: 'Persone rilevate', height: 230 },
  ],
  camera: [
    { id: 13, title: 'Persone rilevate', height: 230 },
  ],
  sentimentAnalysis: [
    { id: 23, title: 'Sentiment Score', height: 250 },
    { id: 14, title: 'Rumore dB', height: 250 },
  ],
  audio: [
    { id: 23, title: 'Sentiment Score', height: 250 },
    { id: 14, title: 'Rumore dB', height: 250 },
  ],
  activityRecognition: [
    { id: 33, title: 'Heart Rate', height: 250 },
  ],
  wearable: [
    { id: 33, title: 'Heart Rate', height: 250 },
  ],
}

function grafanaUrl(panelId, deviceId) {
  const deviceParam = deviceId ? `&var-device_id=${encodeURIComponent(deviceId)}` : ''
  return `${GRAFANA_BASE}/d-solo/${DASHBOARD_UID}/${DASHBOARD_SLUG}?orgId=1&panelId=${panelId}&${TIME_PARAMS}${deviceParam}`
}

// "smartpark:cam-202" → "cam-202"
function extractDeviceId(thingId) {
  if (!thingId) return ''
  const colon = thingId.indexOf(':')
  return colon !== -1 ? thingId.slice(colon + 1) : thingId
}

function GrafanaCharts({ sensorType, deviceId }) {
  const panels = GRAFANA_PANELS[sensorType]
  if (!panels) return null

  return (
    <div className="space-y-4 pt-2">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">
        Grafici Storici &mdash; {deviceId}
      </h3>
      {panels.map(panel => (
        <div key={panel.id} className="rounded-2xl overflow-hidden border border-slate-700/40">
          <iframe
            src={grafanaUrl(panel.id, deviceId)}
            width="100%"
            height={panel.height}
            style={{ border: 'none' }}
            title={panel.title}
            loading="lazy"
          />
        </div>
      ))}
      <p className="text-[9px] text-slate-600 px-1">
        Ultimi 30 min · aggiornamento ogni 5s ·{' '}
        <a
          href={`${GRAFANA_BASE}/d/${DASHBOARD_UID}/${DASHBOARD_SLUG}`}
          target="_blank"
          rel="noreferrer"
          className="text-slate-500 hover:text-slate-300 underline"
        >
          Dashboard completa
        </a>
      </p>
    </div>
  )
}

export default function SensorPanel({ sensorInfo, liveData, connected, onClose }) {
  const thingId = sensorInfo?.thingId || sensorInfo?.id
  const deviceId = extractDeviceId(thingId)

  if (!sensorInfo) return null

  const data = liveData || sensorInfo
  const typeConfig = getTypeConfig(data.attributes?.type)
  const sensorType = data.attributes?.type
  const telemetryData = data.features?.sensors?.properties || data.attributes || {}

  const hasAnomaly = telemetryData.anomaly_detected || data.anomaly || false

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
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
              connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {connected ? 'Live SSE' : 'Offline'}
            </div>
            {hasAnomaly && (
              <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                ⚠ Anomalia
              </div>
            )}
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

          {/* Grafana charts — below all data */}
          <GrafanaCharts sensorType={sensorType} deviceId={deviceId} />

        </div>
      </div>
    </div>
  )
}
