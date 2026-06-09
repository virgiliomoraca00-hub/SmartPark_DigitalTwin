import { useState, useCallback } from 'react'
import { getTypeConfig, getTelemetryMeta, getDesiredMeta } from '../config/sensorConfig'
import { useDittoPatch } from '../hooks/useDittoPatch'

const GRAFANA_BASE = 'http://localhost:3000'
const DASHBOARD_UID = 'smart-park-dynamic'
const DASHBOARD_SLUG = 'smart-park-dynamic'

function extractDeviceId(thingId) {
  if (!thingId) return ''
  const colon = thingId.indexOf(':')
  return colon !== -1 ? thingId.slice(colon + 1) : thingId
}

function timeAgo(dateString) {
  if (!dateString) return 'Sconosciuto'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Non valido'
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'Pochi secondi fa'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min fa`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ore fa`
  return `${Math.floor(diffSec / 86400)} giorni fa`
}

function isSensorOffline(dateString) {
  if (!dateString) return false
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return false
  return (Date.now() - date.getTime()) > (60 * 60 * 1000)
}

// ── Widget: Toggle ─────────────────────────────────────────────────────────
function ToggleWidget({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none ${
        value ? 'bg-red-500 shadow-red-500/40 shadow-lg' : 'bg-slate-700'
      } ${disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
        value ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

// ── Widget: Slider ─────────────────────────────────────────────────────────
function SliderWidget({ value, meta, onChange, disabled }) {
  const [localVal, setLocalVal] = useState(value)
  const min = meta.min ?? 0
  const max = meta.max ?? 100
  const step = meta.step ?? 1
  const pct = ((localVal - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{min}{meta.unit || ''}</span>
        <span className="font-bold text-indigo-300">{localVal}{meta.unit || ''}</span>
        <span>{max}{meta.unit || ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        disabled={disabled}
        onChange={e => setLocalVal(parseFloat(e.target.value))}
        onMouseUp={e => onChange(parseFloat(e.target.value))}
        onTouchEnd={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500"
        style={{
          background: `linear-gradient(to right, #6366f1 ${pct}%, #334155 ${pct}%)`
        }}
      />
    </div>
  )
}

// ── Widget: Select ─────────────────────────────────────────────────────────
function SelectWidget({ value, meta, onChange, disabled }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
    >
      {(meta.options || []).map(opt => (
        <option key={opt} value={opt}>
          {meta.optionLabels?.[opt] || opt}
        </option>
      ))}
    </select>
  )
}

// ── Widget: Text (fallback per chiavi non mappate) ──────────────────────────
function TextWidget({ value, onChange, disabled }) {
  const [localVal, setLocalVal] = useState(String(value ?? ''))
  return (
    <div className="flex gap-2 items-center w-full">
      <input
        type="text"
        value={localVal}
        disabled={disabled}
        onChange={e => setLocalVal(e.target.value)}
        className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 font-mono"
      />
      <button
        onClick={() => onChange(localVal)}
        disabled={disabled}
        className="text-[10px] px-2 py-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/50 transition-all disabled:opacity-50"
      >
        Invia
      </button>
    </div>
  )
}

// ── Sezione metriche ───────────────────────────────────────────────────────
function MetricGrid({ title, data, excludeKeys = [] }) {
  const entries = Object.entries(data).filter(([k, v]) =>
    !excludeKeys.includes(k) && v !== null && v !== undefined
  )
  if (!entries.length) return null

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">{title}</h3>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, value]) => {
          const meta = getTelemetryMeta(key)
          const isNum = typeof value === 'number'
          const isBool = typeof value === 'boolean'
          const displayVal = isBool ? (value ? 'Sì' : 'No') : value
          return (
            <div key={key} className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/30 flex items-center gap-2.5 min-w-0">
              <div className="text-lg bg-slate-800 p-1.5 rounded-lg border border-slate-700/50 shrink-0">{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold text-slate-500 truncate uppercase tracking-wide">{meta.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-sm font-black truncate"
                    style={{ color: meta.color || (isNum ? '#818cf8' : '#e2e8f0') }}>
                    {isNum && !Number.isInteger(value) ? value.toFixed(2) : String(displayVal)}
                  </span>
                  {meta.unit && <span className="text-[9px] text-slate-500 font-bold shrink-0">{meta.unit}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Gateway bar ────────────────────────────────────────────────────────────
function GatewayBar({ label, used, total, unit = '' }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0
  const color = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22d3ee'
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[9px] text-slate-600">{used}{unit} / {total}{unit}</div>
    </div>
  )
}

// ── Pannello Gateway ───────────────────────────────────────────────────────
function GatewayPanel({ data }) {
  if (!data) return null
  const ramUsed = data.EG5120_RAM_total_mb - data.EG5120_RAM_free_mb
  const storageUsedG = parseFloat(data.EG5120_Storage_total) - parseFloat(data.EG5120_Storage_free)
  const cpuAlert = data.EG5120_CPU_status === 'HIGH'

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">🖥️ Gateway EG5120</h3>
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-3 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">CPU Temperature</span>
          <div className="flex items-center gap-2">
            <span className={`font-bold ${cpuAlert ? 'text-red-400' : 'text-cyan-300'}`}>
              {data.EG5120_CPU_Temperature}°C
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
              cpuAlert ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>{data.EG5120_CPU_status}</span>
          </div>
        </div>
        {data.EG5120_RAM_total_mb && (
          <GatewayBar label="RAM" used={ramUsed} total={data.EG5120_RAM_total_mb} unit=" MB" />
        )}
        {data.EG5120_Storage_total && (
          <GatewayBar label="Storage" used={storageUsedG} total={parseFloat(data.EG5120_Storage_total)} unit=" G" />
        )}
      </div>
    </div>
  )
}

// ── Pannello Controllo (DesiredProperties) ─────────────────────────────────
function ControlPanel({ thingId, desiredProperties }) {
  const { patchDesired, getState } = useDittoPatch()
  const [localValues, setLocalValues] = useState(() => ({ ...desiredProperties }))

  const handleChange = useCallback(async (key, value) => {
    setLocalValues(prev => ({ ...prev, [key]: value }))
    await patchDesired(thingId, key, value)
  }, [thingId, patchDesired])

  const entries = Object.entries(desiredProperties)
  if (!entries.length) return null

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">⚙️ Controllo</h3>
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 overflow-hidden divide-y divide-slate-800/50">
        {entries.map(([key]) => {
          const meta = getDesiredMeta(key)
          const value = localValues[key] ?? desiredProperties[key]
          const syncState = getState(thingId, key)
          const isLoading = syncState === 'saving'
          const isError = syncState === 'error'
          const isOk = syncState === 'ok'

          return (
            <div key={key} className="px-3 py-2.5">
              {/* Label + sync indicator */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{meta.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-300 truncate">{meta.label}</div>
                    {meta.unit && meta.widget !== 'slider' && (
                      <div className="text-[9px] text-slate-600">{meta.unit}</div>
                    )}
                  </div>
                </div>

                {/* Widget inline per toggle e select */}
                <div className="flex items-center gap-2 shrink-0">
                  {isLoading && <span className="text-[9px] text-slate-400 animate-pulse">Invio...</span>}
                  {isOk && <span className="text-[9px] text-emerald-400">✓ Salvato</span>}
                  {isError && <span className="text-[9px] text-red-400">✗ Errore</span>}

                  {meta.widget === 'toggle' && (
                    <ToggleWidget
                      value={!!value}
                      onChange={v => handleChange(key, v)}
                      disabled={isLoading}
                    />
                  )}
                  {meta.widget === 'select' && (
                    <SelectWidget
                      value={value}
                      meta={meta}
                      onChange={v => handleChange(key, v)}
                      disabled={isLoading}
                    />
                  )}
                </div>
              </div>

              {/* Slider a larghezza piena */}
              {meta.widget === 'slider' && (
                <SliderWidget
                  value={typeof value === 'number' ? value : meta.min ?? 0}
                  meta={meta}
                  onChange={v => handleChange(key, v)}
                  disabled={isLoading}
                />
              )}

              {/* Fallback text input per chiavi non mappate in DESIRED_META */}
              {meta.widget === 'text' && (
                <TextWidget
                  value={value}
                  onChange={v => handleChange(key, v)}
                  disabled={isLoading}
                />
              )}

              {/* Tooltip descrizione */}
              {meta.description && (
                <div className="text-[9px] text-slate-600 mt-1.5">{meta.description}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente Principale ──────────────────────────────────────────────────
export default function SensorPanel({ sensorInfo, liveData, connected, onClose, onOpenAdvanced }) {
  const thingId = sensorInfo?.thingId || sensorInfo?.id
  const deviceId = extractDeviceId(thingId)

  if (!sensorInfo) return null

  const data = liveData || sensorInfo
  const typeConfig = getTypeConfig(data.attributes?.type)

  // ── Multi-feature extraction ──────────────────────────────────────────────
  const sensorsProps  = data.features?.sensors?.properties        ?? {}
  const motionProps   = data.features?.motion?.properties         ?? {}
  const gatewayProps  = data.features?.gateway?.properties        ?? null
  const desiredProps  = data.features?.sensors?.desiredProperties ?? {}

  const hasMotion  = Object.keys(motionProps).length > 0
  const hasGateway = gatewayProps && Object.keys(gatewayProps).length > 0
  const hasDesired = Object.keys(desiredProps).length > 0

  const hasAnomaly = !!(sensorsProps.anomaly_detected || desiredProps.alert_active)

  // ── Timestamp ─────────────────────────────────────────────────────────────
  const timestamp      = data.attributes?.lastUpdate || sensorsProps.timestamp || data.timestamp
  const lastUpdateStr  = timeAgo(timestamp)
  const isStale        = isSensorOffline(timestamp)
  const isActuallyConnected = connected && !isStale

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

  // Esclusioni campi già mostrati altrove
  const SENSORS_EXCLUDE = new Set(['lat','lng','timestamp','anomaly_detected'])
  const MOTION_EXCLUDE  = new Set(['lat','lng'])
  const ATTRS_EXCLUDE   = new Set(['lat','lng','type','lastUpdate','name','device_id'])

  const displayAttrs = Object.entries(data.attributes || {}).filter(([k]) => !ATTRS_EXCLUDE.has(k))

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 overflow-hidden"
      style={{ borderTop: `4px solid ${typeConfig.color}` }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{typeConfig.mapMarkerIcon}</span>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">
              {sensorInfo.name || deviceId || typeConfig.label}
            </h2>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              {thingId}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-2 hover:bg-slate-800 rounded-full transition-all text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Scroll body ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-6">

          {/* Status badges */}
          <div className="flex items-start gap-3 flex-wrap">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
              isActuallyConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActuallyConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isActuallyConnected ? 'Live SSE' : (isStale ? 'Offline' : 'Disconnesso')}
            </div>
            {hasAnomaly && (
              <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                ⚠ Anomalia
              </div>
            )}
            {desiredProps.alert_active && (
              <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                🚨 Allerta Attiva
              </div>
            )}
            <div className="ml-auto flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] bg-slate-800/80 border border-slate-700 font-bold">
                <span className="text-slate-400">⏱</span>
                <span className={isStale ? 'text-amber-400' : 'text-sky-400'}>{lastUpdateStr}</span>
              </div>
              {exactTimeStr && (
                <div className="text-[10px] text-slate-500 font-mono pr-2">{exactTimeStr}</div>
              )}
            </div>
          </div>

          {/* Misure sensori */}
          {Object.keys(sensorsProps).length > 0 && (
            <MetricGrid
              title="Misure Real-Time"
              data={sensorsProps}
              excludeKeys={[...SENSORS_EXCLUDE]}
            />
          )}

          {/* Dati motion */}
          {hasMotion && (
            <MetricGrid
              title="Dati Movimento / IMU"
              data={motionProps}
              excludeKeys={[...MOTION_EXCLUDE]}
            />
          )}

          {/* Gateway EG5120 */}
          {hasGateway && <GatewayPanel data={gatewayProps} />}

          {/* ── CONTROLLO BIDIREZIONALE ────────────────────────────────── */}
          {hasDesired && (
            <ControlPanel thingId={thingId} desiredProperties={desiredProps} />
          )}

          {/* Attributi base */}
          {displayAttrs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Informazioni Base</h3>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 overflow-hidden divide-y divide-slate-800/50">
                {displayAttrs.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center px-3 py-2 text-xs">
                    <span className="text-slate-400 font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-slate-200 font-mono text-[11px]">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analisi Storica */}
          <div className="space-y-2 pt-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-1">Analisi Storica</h3>
            <button
              onClick={() => onOpenAdvanced?.(thingId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all group"
            >
              <span className="text-2xl">📊</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-bold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                  Monitoraggio Avanzato
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Grafici storici filtrati su questo sensore
                </div>
              </div>
              <svg className="w-4 h-4 text-emerald-500/60 group-hover:text-emerald-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <a
              href={`${GRAFANA_BASE}/d/${DASHBOARD_UID}/${DASHBOARD_SLUG}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 transition-all"
            >
              <span>📈</span>
              <span>Apri Grafana Dashboard</span>
              <span className="ml-auto opacity-60">↗</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  )
}
