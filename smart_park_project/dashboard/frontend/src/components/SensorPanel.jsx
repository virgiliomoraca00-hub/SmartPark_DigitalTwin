import { getTypeConfig, getTelemetryMeta } from '../config/sensorConfig'

/**
 * SensorPanel — Visualizes sensor data using sensorConfig definitions.
 */
export default function SensorPanel({ sensorInfo, liveData, connected, onClose }) {
  const thingId = sensorInfo?.thingId || sensorInfo?.id

  if (!sensorInfo) return null

  // Use liveData if available, fallback to sensorInfo
  const data = liveData || sensorInfo
  const typeConfig = getTypeConfig(data.attributes?.type)
  const telemetryData = data.features?.sensors?.properties || data.attributes || {}
  
  const hasAnomaly = telemetryData.anomaly_detected || data.anomaly || false

  // Filter out lat/lng for metrics display
  const displayMetrics = Object.entries(telemetryData).filter(([key]) => key !== 'lat' && key !== 'lng')
  
  // Extract attributes that are not in telemetry
  const displayAttributes = Object.entries(data.attributes || {}).filter(([key]) => 
    key !== 'lat' && key !== 'lng' && key !== 'type' && !telemetryData.hasOwnProperty(key)
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 overflow-hidden" style={{ borderTop: `4px solid ${typeConfig.color}` }}>
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

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5 space-y-6">
          
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
              connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
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

          {/* Metrics Section */}
          {displayMetrics.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Misure Real-Time</h3>
              <div className="grid grid-cols-1 gap-3">
                {displayMetrics.map(([key, value]) => {
                  const meta = getTelemetryMeta(key)
                  const displayValue = typeof value === 'boolean' ? (value ? "Sì" : "No") : value
                  
                  // Simple styling per value type
                  const isNumber = typeof value === 'number'
                  
                  return (
                    <div key={key} className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30 flex items-center gap-4">
                      <div className="text-2xl bg-slate-800 p-2 rounded-xl border border-slate-700/50">
                        {meta.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-slate-400">{meta.label}</div>
                        <div className="mt-1">
                          <span 
                            className="text-xl font-black" 
                            style={meta.color ? { color: meta.color } : { color: isNumber ? '#818cf8' : '#e2e8f0' }}
                          >
                            {isNumber && !Number.isInteger(value) ? value.toFixed(2) : displayValue}
                          </span>
                          {meta.unit && (
                            <span className="text-[10px] text-slate-500 ml-1 font-bold">{meta.unit}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Additional Attributes Section */}
          {displayAttributes.length > 0 && (
            <div className="space-y-4 pt-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Informazioni Base</h3>
              <div className="bg-slate-800/30 rounded-2xl border border-slate-700/30 overflow-hidden divide-y divide-slate-800/50">
                {displayAttributes.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center p-3.5 text-xs">
                    <span className="text-slate-400 font-medium capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-slate-200 font-mono text-[11px]">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
