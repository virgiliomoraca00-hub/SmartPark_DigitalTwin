import { useState, useMemo, useCallback, useEffect } from 'react'
import { deriveSchema, TYPE_ICONS, TYPE_LABELS, schemaStats } from '../utils/thingSchema'

// ── Configurazione Grafana ─────────────────────────────────────────────────
const GRAFANA_BASE   = 'http://localhost:3000'
const DASH_UID       = 'smart-park-dynamic'
const DASH_SLUG      = 'smart-park-dynamic'
const DASH_STATIC_UID  = 'smart-park-v1'
const DASH_STATIC_SLUG = 'smart-park'

// ── Intervalli temporali ───────────────────────────────────────────────────
const TIME_RANGES = [
  { label: '15 min', value: 'now-15m' },
  { label: '30 min', value: 'now-30m' },
  { label: '1 ora',  value: 'now-1h'  },
  { label: '3 ore',  value: 'now-3h'  },
  { label: '6 ore',  value: 'now-6h'  },
  { label: '24 ore', value: 'now-24h' },
]

// Panel ID nella dashboard dinamica
const PANEL_TIMESERIES = 200  // time series multi-sensore
const PANEL_STAT       = 201  // ultimi valori
const PANEL_COMPARE    = 202  // confronto side-by-side

// ── URL Builder Grafana ────────────────────────────────────────────────────
/**
 * Costruisce l'URL per un iframe Grafana con variabili dinamiche.
 * Supporta multi-valore per sensor_id e field.
 */
function buildGrafanaUrl({ panelId, from, deviceIds = [], fields = [], uid = DASH_UID, slug = DASH_SLUG }) {
  const params = new URLSearchParams()
  params.set('orgId', '1')
  params.set('panelId', panelId)
  params.set('from', from)
  params.set('to', 'now')
  params.set('refresh', '15s')
  params.set('theme', 'dark')

  // Multi-value: var-sensor_id=X&var-sensor_id=Y
  for (const id of deviceIds) params.append('var-sensor_id', id)
  for (const f of fields)     params.append('var-field', `data_${f}`)

  return `${GRAFANA_BASE}/d-solo/${uid}/${slug}?${params.toString()}`
}

// ── Componente: Checkbox con indentazione ─────────────────────────────────
function TreeCheckbox({ checked, indeterminate, onChange, label, dim = false, count }) {
  return (
    <label className={`flex items-center gap-2.5 cursor-pointer group select-none ${dim ? 'opacity-50' : ''}`}>
      <span
        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
          checked
            ? 'bg-emerald-500 border-emerald-500'
            : indeterminate
            ? 'bg-emerald-500/40 border-emerald-500/60'
            : 'border-slate-600 group-hover:border-slate-400 bg-slate-800'
        }`}
        onClick={onChange}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {!checked && indeterminate && (
          <span className="w-2.5 h-0.5 bg-emerald-300 rounded" />
        )}
      </span>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors flex-1 truncate">
        {label}
      </span>
      {count != null && (
        <span className="text-xs text-slate-500 font-mono shrink-0">{count}</span>
      )}
    </label>
  )
}

// ── Componente: Albero Filtri ──────────────────────────────────────────────
function ThingTreeFilter({ schema, selection, onToggleMetric, onToggleThing, onToggleZone, onToggleType }) {
  const [openTypes, setOpenTypes] = useState({})
  const [openZones, setOpenZones] = useState({})
  const [openThings, setOpenThings] = useState({})

  const toggle = (dict, setDict, key) =>
    setDict(d => ({ ...d, [key]: !d[key] }))

  return (
    <div className="space-y-1">
      {Object.entries(schema).map(([type, zones]) => {
        // Calcola stato checkbox tipo (checked / indeterminate / unchecked)
        const allMetricsInType = Object.values(zones).flatMap(items =>
          Object.values(items).flatMap(item => item.metrics.map(m => `${item.thingId}::${m}`))
        )
        const selectedInType = allMetricsInType.filter(k => selection.has(k)).length
        const typeChecked = selectedInType === allMetricsInType.length && allMetricsInType.length > 0
        const typeIndet  = selectedInType > 0 && !typeChecked

        // Numero di sensori unici (Things) per questo tipo
        const sensorCountInType = Object.values(zones).reduce(
          (acc, items) => acc + Object.keys(items).length, 0
        )

        return (
          <div key={type} className="rounded-lg overflow-hidden border border-slate-800/60">
            {/* L1: Tipo ─────────────────────────────────────────────────── */}
            <div
              className="flex items-center gap-2 px-3 py-3 bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors"
              onClick={() => toggle(openTypes, setOpenTypes, type)}
            >
              <span className="text-base">{TYPE_ICONS[type] ?? '📡'}</span>
              <TreeCheckbox
                checked={typeChecked}
                indeterminate={typeIndet}
                onChange={e => { e.stopPropagation(); onToggleType(type, schema[type]) }}
                label={TYPE_LABELS[type] ?? type}
                count={sensorCountInType}
              />
              <span className={`ml-auto text-slate-500 transition-transform ${openTypes[type] ? 'rotate-90' : ''}`}>▶</span>
            </div>

            {openTypes[type] && (
              <div className="pl-3 border-t border-slate-800/40">
                {Object.entries(zones).map(([zone, items]) => {
                  // Stato checkbox zona
                  const allInZone = Object.values(items).flatMap(item =>
                    item.metrics.map(m => `${item.thingId}::${m}`)
                  )
                  const selInZone = allInZone.filter(k => selection.has(k)).length
                  const zoneChecked = selInZone === allInZone.length && allInZone.length > 0
                  const zoneIndet  = selInZone > 0 && !zoneChecked

                  return (
                    <div key={zone} className="border-b border-slate-800/30 last:border-0">
                      {/* L2: Zona ─────────────────────────────────────── */}
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/30 cursor-pointer transition-colors"
                        onClick={() => toggle(openZones, setOpenZones, `${type}::${zone}`)}
                      >
                        <span className="text-[10px] text-slate-500">📍</span>
                        <TreeCheckbox
                          checked={zoneChecked}
                          indeterminate={zoneIndet}
                          onChange={e => { e.stopPropagation(); onToggleZone(zone, items) }}
                          label={zone}
                          count={Object.keys(items).length}
                        />
                        <span className={`ml-auto text-slate-600 text-[10px] transition-transform ${openZones[`${type}::${zone}`] ? 'rotate-90' : ''}`}>▶</span>
                      </div>

                      {openZones[`${type}::${zone}`] && (
                        <div className="pl-5">
                          {Object.entries(items).map(([thingId, info]) => {
                            const allInThing = info.metrics.map(m => `${thingId}::${m}`)
                            const selInThing = allInThing.filter(k => selection.has(k)).length
                            const thingChecked = selInThing === allInThing.length && allInThing.length > 0
                            const thingIndet  = selInThing > 0 && !thingChecked

                            return (
                              <div key={thingId} className="border-b border-slate-800/20 last:border-0">
                                {/* L3a: Sensore ─────────────────────── */}
                                <div
                                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800/20 cursor-pointer transition-colors"
                                  onClick={() => toggle(openThings, setOpenThings, thingId)}
                                >
                                  <TreeCheckbox
                                    checked={thingChecked}
                                    indeterminate={thingIndet}
                                    onChange={e => { e.stopPropagation(); onToggleThing(thingId, info) }}
                                    label={info.label}
                                    count={info.metrics.length}
                                  />
                                  <span className={`ml-auto text-slate-700 text-[9px] transition-transform ${openThings[thingId] ? 'rotate-90' : ''}`}>▶</span>
                                </div>

                                {/* L3b: Metriche ─────────────────────── */}
                                {openThings[thingId] && (
                                  <div className="pl-6 pb-1 space-y-0.5">
                                    {info.metrics.map(metric => {
                                      const key = `${thingId}::${metric}`
                                      return (
                                        <div key={key} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-slate-800/20 transition-colors">
                                          <TreeCheckbox
                                            checked={selection.has(key)}
                                            indeterminate={false}
                                            onChange={() => onToggleMetric(key)}
                                            label={metric}
                                          />
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Componente: Panel Grafana dinamico ────────────────────────────────────
function GrafanaPanel({ title, subtitle, url, height = 320 }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <span className="text-[11px] font-bold text-slate-300">{title}</span>
          {subtitle && (
            <span className="ml-2 text-[9px] text-slate-600 font-mono">{subtitle}</span>
          )}
        </div>
        <a
          href={url.replace('/d-solo/', '/d/')}
          target="_blank"
          rel="noreferrer"
          className="text-[9px] text-slate-600 hover:text-emerald-400 transition-colors"
        >
          ↗
        </a>
      </div>
      <iframe
        key={url}
        src={url}
        width="100%"
        height={height}
        style={{ border: 'none', display: 'block' }}
        title={title}
        loading="lazy"
      />
    </div>
  )
}

// ── Componente principale ─────────────────────────────────────────────────
export default function AdvancedMonitoring({ onClose, sseThings = {}, preselectedThingId = null }) {
  const [timeRange, setTimeRange]   = useState('now-1h')
  const [selection, setSelection]   = useState(new Set())   // Set<"thingId::metric">
  const [panelMode, setPanelMode]   = useState('grouped')   // 'grouped' | 'single'
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Deriva schema una sola volta per render cycle (aggiornato se SSE porta nuovi Things)
  const schema = useMemo(() => deriveSchema(sseThings), [sseThings])
  const stats  = useMemo(() => schemaStats(schema), [schema])

  // ── Auto-selezione al mount con preselectedThingId ───────────────────────
  // Si attiva una sola volta quando schema è pronto e thingId è valorizzato
  const [hasAutoSelected, setHasAutoSelected] = useState(false)
  useEffect(() => {
    if (!preselectedThingId || hasAutoSelected) return
    // Cerca il thing nello schema e seleziona tutte le sue metriche
    for (const zones of Object.values(schema)) {
      for (const items of Object.values(zones)) {
        if (items[preselectedThingId]) {
          const info = items[preselectedThingId]
          const keys = info.metrics.map(m => `${preselectedThingId}::${m}`)
          setSelection(new Set(keys))
          setHasAutoSelected(true)
          return
        }
      }
    }
  }, [schema, preselectedThingId, hasAutoSelected])

  // ── Toggle handlers ─────────────────────────────────────────────────────
  const toggleMetric = useCallback((key) => {
    setSelection(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const toggleThing = useCallback((thingId, info) => {
    setSelection(prev => {
      const next = new Set(prev)
      const keys = info.metrics.map(m => `${thingId}::${m}`)
      const allSel = keys.every(k => prev.has(k))
      keys.forEach(k => allSel ? next.delete(k) : next.add(k))
      return next
    })
  }, [])

  const toggleZone = useCallback((zone, items) => {
    setSelection(prev => {
      const next = new Set(prev)
      const keys = Object.values(items).flatMap(info =>
        info.metrics.map(m => `${info.thingId}::${m}`)
      )
      const allSel = keys.every(k => prev.has(k))
      keys.forEach(k => allSel ? next.delete(k) : next.add(k))
      return next
    })
  }, [])

  const toggleType = useCallback((type, zones) => {
    setSelection(prev => {
      const next = new Set(prev)
      const keys = Object.values(zones).flatMap(items =>
        Object.values(items).flatMap(info => info.metrics.map(m => `${info.thingId}::${m}`))
      )
      const allSel = keys.every(k => prev.has(k))
      keys.forEach(k => allSel ? next.delete(k) : next.add(k))
      return next
    })
  }, [])

  const clearAll = () => setSelection(new Set())

  // ── Costruzione panel dinamici dalla selezione ──────────────────────────
  // Raggruppa per metrica → un panel per metrica con tutti i sensori selezionati
  const panels = useMemo(() => {
    if (selection.size === 0) return []

    // Map: metrica → Set<deviceId>
    const metricToDevices = new Map()

    for (const key of selection) {
      const [thingId, metric] = key.split('::')
      const deviceId = thingId.split(':')[1] ?? thingId
      if (!metricToDevices.has(metric)) metricToDevices.set(metric, new Set())
      metricToDevices.get(metric).add(deviceId)
    }

    return Array.from(metricToDevices.entries()).map(([metric, devicesSet]) => {
      const deviceIds = Array.from(devicesSet)
      const url = buildGrafanaUrl({
        panelId: PANEL_TIMESERIES,
        from: timeRange,
        deviceIds,
        fields: [metric],
      })
      return {
        id: `${metric}-${deviceIds.join('-')}`,
        title: metric.replace(/_/g, ' '),
        subtitle: `${deviceIds.length} sensor${deviceIds.length > 1 ? 'i' : 'e'}`,
        url,
        deviceIds,
        metric,
      }
    })
  }, [selection, timeRange])

  // Panel "confronto globale": tutti i device selezionati, tutte le metriche
  const allDevices = useMemo(() => {
    const ids = new Set()
    for (const key of selection) {
      const [thingId] = key.split('::')
      ids.add(thingId.split(':')[1] ?? thingId)
    }
    return Array.from(ids)
  }, [selection])

  const allMetrics = useMemo(() => {
    const ms = new Set()
    for (const key of selection) {
      const [, metric] = key.split('::')
      ms.add(metric)
    }
    return Array.from(ms)
  }, [selection])

  const isEmpty = Object.keys(schema).length === 0

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-950/98 backdrop-blur-sm flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-7 border-b border-slate-800 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="ml-4 p-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            title="Mostra/Nascondi filtri"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-2xl">📊</span>
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Monitoraggio Avanzato</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-emerald-400 font-semibold">📡 {stats.things} sensori</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-sky-400 font-semibold">📈 {stats.metrics} metriche</span>
              <span className="text-slate-600">·</span>
              <span className={`text-xs font-semibold ${selection.size > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                ✓ {selection.size} attive
              </span>
            </div>
          </div>
        </div>

        {/* Time range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-widest mr-2 font-semibold">Intervallo</span>
          {TIME_RANGES.map(tr => (
            <button
              key={tr.value}
              onClick={() => setTimeRange(tr.value)}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
                timeRange === tr.value
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-600'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Panel mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanelMode('grouped')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all border ${
                panelMode === 'grouped'
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-500'
              }`}
              title="Panel per metrica"
            >⊞ Raggruppati</button>
            <button
              onClick={() => setPanelMode('single')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all border ${
                panelMode === 'single'
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-500'
              }`}
              title="Panel unico confronto"
            >⊟ Confronto</button>
          </div>

          <a
            href={`${GRAFANA_BASE}/d/${DASH_UID}/${DASH_SLUG}`}
            target="_blank" rel="noreferrer"
            className="px-5 py-2 text-sm font-bold text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-all"
          >
            Grafana ↗
          </a>

          <button
            onClick={onClose}
            className="mr-4 p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white border border-slate-700/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar filtri */}
        {sidebarOpen && (
          <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
            <div className="px-4 py-4 border-b border-slate-800 flex items-center shrink-0">
              <span className="text-sm font-bold text-slate-200 uppercase tracking-widest flex-1">Filtri Sensori</span>
              {selection.size > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors font-semibold px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40"
                  style={{ marginRight: '10px' }}
                >
                  Deseleziona tutti
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
              {isEmpty ? (
                <div className="text-center py-12 space-y-2">
                  <div className="text-3xl">📡</div>
                  <p className="text-[11px] text-slate-500">In attesa dei dati SSE...</p>
                  <p className="text-[10px] text-slate-700">I sensori appariranno automaticamente</p>
                </div>
              ) : (
                <ThingTreeFilter
                  schema={schema}
                  selection={selection}
                  onToggleMetric={toggleMetric}
                  onToggleThing={toggleThing}
                  onToggleZone={toggleZone}
                  onToggleType={toggleType}
                />
              )}
            </div>

            {/* Selezione attiva summary */}
            {selection.size > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-900 shrink-0">
                <p className="text-[10px] text-emerald-400 font-bold">
                  {selection.size} metrica{selection.size > 1 ? 'he' : ''} selezionat{selection.size > 1 ? 'e' : 'a'}
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">
                  {allDevices.length} sensore{allDevices.length > 1 ? 'i' : ''} · {allMetrics.length} tipo{allMetrics.length > 1 ? 'logie' : 'logia'}
                </p>
              </div>
            )}
          </aside>
        )}

        {/* Area panel */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">

          {selection.size === 0 ? (
            /* Stato vuoto */
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-3xl">
                🎛️
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-1">Nessun sensore selezionato</h3>
                <p className="text-[12px] text-slate-500 max-w-xs">
                  Usa il pannello a sinistra per selezionare uno o più sensori.
                  Puoi selezionare metriche di tipo diverso per confrontarle.
                </p>
              </div>

              {/* Suggerimento: apri Grafana statico se l'albero è vuoto */}
              {isEmpty && (
                <a
                  href={`${GRAFANA_BASE}/d/${DASH_STATIC_UID}/${DASH_STATIC_SLUG}`}
                  target="_blank" rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[12px] font-bold hover:bg-emerald-500/20 transition-all"
                >
                  Apri Dashboard Completa ↗
                </a>
              )}
            </div>

          ) : panelMode === 'grouped' ? (
            /* ── Modalità Raggruppata: 1 panel per metrica ─────────────── */
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">
                  Analisi per Metrica
                </h3>
                <div className="flex-1 h-px bg-slate-800 ml-2" />
                <span className="text-xs text-slate-500 font-semibold">{panels.length} panel attivi</span>
              </div>

              <div className={`grid gap-5 ${panels.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-3xl'}`}>
                {panels.map(p => (
                  <GrafanaPanel
                    key={p.id}
                    title={p.title}
                    subtitle={`${p.deviceIds.join(', ')}`}
                    url={p.url}
                    height={320}
                  />
                ))}
              </div>
            </div>

          ) : (
            /* ── Modalità Confronto: panel unico multi-device ───────────── */
            <div className="space-y-5 max-w-5xl">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Confronto Multi-Sensore
                </h3>
                <div className="flex-1 h-px bg-slate-800 ml-2" />
              </div>

              {/* Panel time series aggregato */}
              <GrafanaPanel
                title={`Confronto: ${allMetrics.map(m => m.replace(/_/g, ' ')).join(' · ')}`}
                subtitle={`${allDevices.length} sensori`}
                url={buildGrafanaUrl({
                  panelId: PANEL_COMPARE,
                  from: timeRange,
                  deviceIds: allDevices,
                  fields: allMetrics,
                })}
                height={400}
              />

              {/* Stat panel ultimo valore per ogni sensore selezionato */}
              {allDevices.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ultimi valori</span>
                    <div className="flex-1 h-px bg-slate-800 ml-2" />
                  </div>
                  <div className={`grid gap-4 ${allDevices.length > 2 ? 'grid-cols-3' : `grid-cols-${allDevices.length}`}`}>
                    {allDevices.slice(0, 6).map(devId => (
                      <GrafanaPanel
                        key={devId}
                        title={devId}
                        url={buildGrafanaUrl({
                          panelId: PANEL_STAT,
                          from: timeRange,
                          deviceIds: [devId],
                          fields: allMetrics,
                        })}
                        height={160}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-center text-[9px] text-slate-800 uppercase tracking-widest pt-6 pb-2">
            Dati da InfluxDB via Grafana · Schema derivato da Eclipse Ditto SSE
          </p>
        </main>
      </div>
    </div>
  )
}
