import { getTypeConfig, sensorTypesMap } from '../config/sensorConfig'

/**
 * SensorList — Left sidebar showing sensors grouped by type.
 * Groups are derived dynamically from sseThings feature keys.
 */
export default function SensorList({ initialPins, sseThings, selectedSensor, onSelectSensor }) {
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
