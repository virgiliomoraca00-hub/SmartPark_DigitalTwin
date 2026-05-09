import { getTypeConfig, getTelemetryMeta, sensorTypesMap } from '../config/sensorConfig'

/**
 * SensorList — Left sidebar showing sensors grouped by type.
 * Groups are derived dynamically from sseThings feature keys.
 */
export default function SensorList({ initialPins, sseThings, selectedSensor, onSelectSensor, typeFilter, availableTypes = [], onTypeFilter, availableMetrics = [], metricFilter, onMetricFilter }) {
  // Build groups: { type -> [pin, ...] }
  const groups = {}

  initialPins.forEach(pin => {
    const liveData = sseThings[pin.thingId]
    const typeSource = liveData ?? pin
    const type = typeSource.attributes?.type || "default"
    if (!groups[type]) groups[type] = []
    groups[type].push({ ...pin, type, liveData })
  })

  const groupEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))

  if (initialPins.length === 0) {
    return (
      <div className="w-56 h-full bg-slate-900/80 border-r border-slate-800 flex flex-col items-center justify-center gap-3 text-center px-4">
        <span className="text-3xl">📡</span>
        <p className="text-xs text-slate-500">Nessun sensore con coordinate trovato</p>
      </div>
    )
  }

  return (
    <div className="w-56 h-full bg-slate-900/80 border-r border-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-800">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Sensori</p>
        <p className="text-xs text-slate-300 font-semibold mt-0.5">{initialPins.length} dispositivi</p>
      </div>

      {/* Filtro per tipo — pill-bar */}
      {availableTypes.length > 1 && (
        <div className="px-2 py-2 border-b border-slate-800 flex flex-col gap-1">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1 mb-0.5">Filtra tipo</p>
          <button
            onClick={() => onTypeFilter && onTypeFilter(null)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
              typeFilter === null
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-slate-700'
            }`}
          >
            📡 Tutti
          </button>
          {availableTypes.map(type => {
            const cfg = getTypeConfig(type)
            const isActive = typeFilter === type
            return (
              <button
                key={type}
                onClick={() => onTypeFilter && onTypeFilter(type)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                  isActive
                    ? 'border-[var(--tc)] text-white'
                    : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-slate-700'
                }`}
                style={isActive ? {
                  '--tc': cfg.color,
                  backgroundColor: cfg.color + '22',
                  borderColor: cfg.color + '66',
                  color: cfg.color,
                } : {}}
              >
                {cfg.mapMarkerIcon} {cfg.label}
              </button>
            )
          })}

          {/* Sottomenu Metriche (visibile solo se c'è un tipo selezionato) */}
          {typeFilter && availableMetrics.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800">
               <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1 mb-1">Mappa Metrica (Live)</p>
               <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                 {availableMetrics.map(metric => {
                    const meta = getTelemetryMeta(metric)
                    const isActive = metricFilter === metric
                    return (
                      <button
                        key={metric}
                        onClick={() => onMetricFilter && onMetricFilter(metric)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] transition-all border ${
                          isActive
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/30 font-bold'
                            : 'text-slate-400 hover:bg-slate-800 border-transparent hover:text-slate-200'
                        }`}
                        title={meta.label}
                      >
                         <span className="flex items-center gap-1.5 truncate">
                           <span>{meta.icon}</span>
                           <span className="truncate">{meta.label}</span>
                         </span>
                         {isActive && <span className="text-[8px] text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded">LIVE</span>}
                      </button>
                    )
                 })}
               </div>
            </div>
          )}
        </div>
      )}
      {/* Group list */}
      <div className="flex-1 overflow-y-auto py-2">
        {groupEntries.map(([type, pins]) => {
          const config = getTypeConfig(type)

          return (
            <div key={type} className="mb-1">
              {/* Group header */}
              <div className="flex items-center gap-2 px-3 py-1.5" style={{ color: config.color }}>
                <span className="text-sm">{config.mapMarkerIcon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {config.label}
                </span>
                <span className="ml-auto text-[10px] text-slate-500 font-mono">{pins.length}</span>
              </div>

              {/* Sensors in group */}
              {pins.map(pin => {
                const isSelected = selectedSensor?.thingId === pin.thingId
                const hasAnomaly = pin.liveData?.anomaly || pin.liveData?.anomaly_detected || pin.liveData?.features?.sensors?.properties?.anomaly_detected

                return (
                  <button
                    key={pin.thingId}
                    onClick={() => onSelectSensor(isSelected ? null : pin)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all
                      ${isSelected
                        ? `bg-slate-800 border-l-2`
                        : 'border-l-2 border-transparent hover:bg-slate-800/50'
                      }`}
                    style={{ borderLeftColor: isSelected ? config.color : 'transparent' }}
                  >
                    {/* Status dot */}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      hasAnomaly ? 'bg-red-400 animate-pulse'
                      : pin.liveData ? 'bg-green-400'
                      : 'bg-slate-600'
                    }`} />

                    {/* Name */}
                    <span className={`text-xs font-medium truncate ${
                      isSelected ? 'text-white' : 'text-slate-300'
                    }`}>
                      {pin.name}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
