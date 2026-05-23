import { Fragment, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon, Circle, Rectangle } from 'react-leaflet'
import { getTypeConfig, sensorTypesMap, getTelemetryMeta } from '../config/sensorConfig'
import { ZONES, GRID_LABELS, PARK_BOUNDS } from '../utils/zoneConfig'
import 'leaflet/dist/leaflet.css'

const ANOMALY_COLOR = '#ef4444'
const LEGEND_TYPES = ['environmental', 'camera', 'audio', 'wearable']

// Palette colori per le zone (ciclica)
const ZONE_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#3b82f6', // blue
]

/**
 * ZoneOverlay — mostra le zone sulla mappa.
 * Modalità POI (ZONES popolato): disegna cerchi con raggio in metri.
 * Modalità Geo-Grid (ZONES vuoto): disegna celle rettangolari sul bbox dei sensori.
 * Reagisce automaticamente alle modifiche di zoneConfig.js via Vite HMR.
 */
function ZoneOverlay() {
  // ── Modalità POI: ZONES ha zone semantiche ─────────────────────────────────
  if (ZONES.length > 0) {
    return ZONES.map((zone, i) => (
      <Circle
        key={zone.id}
        center={[zone.lat, zone.lng]}
        radius={(zone.radius ?? 0.001) * 111_000}  // gradi → metri (~111 km/grado)
        pathOptions={{
          color:       ZONE_COLORS[i % ZONE_COLORS.length],
          fillColor:   ZONE_COLORS[i % ZONE_COLORS.length],
          fillOpacity: 0.08,
          weight:      1.5,
          dashArray:   '6 4',
        }}
      >
        <Tooltip permanent direction="center" opacity={0.85}
          className="zone-label-tooltip"
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: ZONE_COLORS[i % ZONE_COLORS.length] }}>
            {zone.label}
          </span>
        </Tooltip>
      </Circle>
    ))
  }

  // ── Modalità Geo-Grid: usa PARK_BOUNDS fisso (perimetro reale della riserva) ─
  const { minLat, maxLat, minLng, maxLng } = PARK_BOUNDS
  const latRange = maxLat - minLat
  const lngRange = maxLng - minLng

  const cells = []
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      // Riga 0 = Nord (lat alta), riga 1 = Sud (lat bassa)
      const cellLatMax = maxLat - (row / 2) * latRange
      const cellLatMin = maxLat - ((row + 1) / 2) * latRange
      const cellLngMin = minLng + (col / 3) * lngRange
      const cellLngMax = minLng + ((col + 1) / 3) * lngRange
      const idx = row * 3 + col
      const label = GRID_LABELS[row][col]
      if (label === 'Zona NE') continue

      cells.push({
        bounds: [[cellLatMin, cellLngMin], [cellLatMax, cellLngMax]],
        label:  label,
        color:  ZONE_COLORS[idx % ZONE_COLORS.length],
        center: [(cellLatMin + cellLatMax) / 2, (cellLngMin + cellLngMax) / 2],
      })
    }
  }

  return cells.map(cell => (
    <Fragment key={cell.label}>
      <Rectangle
        bounds={cell.bounds}
        pathOptions={{
          color:       cell.color,
          fillColor:   cell.color,
          fillOpacity: 0.06,
          weight:      1,
          dashArray:   '4 4',
          interactive: false,
        }}
      />
      <Circle
        center={cell.center}
        radius={1}  // punto invisibile — solo per il Tooltip
        pathOptions={{ fillOpacity: 0, opacity: 0, interactive: false }}
      >
        <Tooltip permanent direction="center" opacity={0.85}
          className="zone-label-tooltip"
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: cell.color }}>
            {cell.label}
          </span>
        </Tooltip>
      </Circle>
    </Fragment>
  ))
}

export default function ParkMap({ initialPins = [], sseThings = {}, selectedSensor, onSelectSensor, metricFilter }) {
  const [showZones, setShowZones] = useState(true)
  // Limiti geografici restrittivi (pochi km attorno ai Giganti della Sila)
  const parkBounds = [
    [39.315000, 16.455000], // Sud-Ovest
    [39.335000, 16.480000]  // Nord-Est
  ]

  // Coordinate del perimetro della Riserva Statale "I Giganti della Sila"
  const reservePerimeter = [
    [39.3239168, 16.466235],
    [39.3234522, 16.466466],
    [39.3235048, 16.4676417],
    [39.323559, 16.4681864],
    [39.3236335, 16.4690445],
    [39.3236708, 16.4691654],
    [39.3237774, 16.4691252],
    [39.3238709, 16.4690944],
    [39.3240964, 16.4690636],
    [39.3243952, 16.4691885],
    [39.3244585, 16.4689148],
    [39.3243182, 16.4688331],
    [39.3243402, 16.4686838],
    [39.3249506, 16.4686518],
    [39.3250166, 16.4683106],
    [39.3261823, 16.4675287],
    [39.3263583, 16.4672017],
    [39.3258634, 16.4664198],
    [39.3239168, 16.466235]
  ];

  return (
    <div className="relative w-full h-full bg-stone-100">
      <MapContainer
        center={[39.324540, 16.467701]}
        zoom={17}
        minZoom={17}
        maxZoom={19}
        maxBounds={parkBounds}
        maxBoundsViscosity={1.0}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          maxNativeZoom={19}
        />

        {/* Highlight Perimetro Riserva */}
        <Polygon
          positions={reservePerimeter}
          pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.15, weight: 3, dashArray: '4, 4' }}
        />

        {/* Layer Zone — POI circles o Geo-Grid rettangolare */}
        {showZones && <ZoneOverlay />}

        {initialPins.map(sensor => {
          const data = sseThings[sensor.thingId]
          // Type resolution: prefer live SSE data features, fallback to pin's own features (from initial fetch)
          const typeSource = data ?? sensor
          const type = typeSource.attributes?.type || "default"
          const config = getTypeConfig(type)
          const typeColor = config.color
          const isSelected = selectedSensor?.thingId === sensor.thingId
          const hasAnomaly = data?.anomaly || data?.anomaly_detected || data?.features?.sensors?.properties?.anomaly_detected
          const markerColor = hasAnomaly ? ANOMALY_COLOR : typeColor

          // Coordinate: per i wearable aggiornano in tempo reale via SSE,
          // per i sensori fissi vengono dai attributes (già in sensor.lat/lng)
          const lat = data?.attributes?.lat ?? data?.lat ?? data?.features?.sensors?.properties?.lat ?? sensor.lat
          const lng = data?.attributes?.lng ?? data?.lng ?? data?.features?.sensors?.properties?.lng ?? sensor.lng

          const r = isSelected ? 10 : 7;

          // Valore metric live
          let metricValue = null
          let metricMeta = null
          if (metricFilter && data) {
            // Cerchiamo la metrica sia con data_ prefix che senza
            const props = data.features?.sensors?.properties || {}
            let val = props[metricFilter]
            if (val === undefined) val = props[`data_${metricFilter}`]
            if (val !== undefined) {
               metricValue = val
               metricMeta = getTelemetryMeta(metricFilter)
            }
          }

          return (
            <Fragment key={sensor.thingId}>
              {/* Anello lampeggiante per anomalia */}
              {hasAnomaly && (
                <CircleMarker
                  center={[lat, lng]}
                  radius={r + 5}
                  pathOptions={{
                    color: ANOMALY_COLOR,
                    fillOpacity: 0,
                    weight: 2.5,
                    className: 'anomaly-ring',
                    interactive: false
                  }}
                />
              )}

              {/* Marker Sensor */}
              <CircleMarker
                center={[lat, lng]}
                radius={r}
                pathOptions={{
                  fillColor: markerColor,
                  color: isSelected ? 'white' : '#1c1917',
                  weight: isSelected ? 2 : 1,
                  fillOpacity: 0.9,
                }}
                eventHandlers={{
                  click: () => onSelectSensor(isSelected ? null : sensor)
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="font-sans text-xs">
                    <strong className="block">{config.mapMarkerIcon} {sensor.name}</strong>
                    <span className="text-[10px] text-gray-400 mb-1 block">ID: {sensor.thingId}</span>
                  </div>
                </Tooltip>
              </CircleMarker>

              {/* Permanent Tooltip per il valore della metrica (se attiva) posizionato su un marker invisibile per evitare conflitti */}
              {metricValue !== null && (
                <CircleMarker
                  center={[lat, lng]}
                  radius={0}
                  pathOptions={{ opacity: 0, fillOpacity: 0, interactive: false }}
                >
                  <Tooltip permanent direction="bottom" offset={[0, r + 2]} opacity={0.9} className="metric-live-tooltip">
                    <div className="font-sans text-[10px] font-bold text-sky-400 bg-slate-900/80 px-1 py-0.5 rounded border border-sky-500/30 whitespace-nowrap shadow-lg">
                      {metricMeta?.icon} {typeof metricValue === 'number' ? metricValue.toFixed(1) : metricValue} <span className="text-[9px] text-sky-500/70">{metricMeta?.unit}</span>
                    </div>
                  </Tooltip>
                </CircleMarker>
              )}
            </Fragment>
          )
        })}
      </MapContainer>

      {/* Legenda per tipo */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 py-4 pr-5 border border-slate-700/50 text-xs shadow-xl" style={{ zIndex: 1000 }}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-4">Tipo Sensore</p>
        {LEGEND_TYPES.map(type => {
          const cfg = sensorTypesMap[type]
          return (
            <div key={type} className="flex items-center gap-2.5 py-1 pl-4">
              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-slate-300">{cfg.mapMarkerIcon} {cfg.label}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-slate-700/50 pl-4">
          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: ANOMALY_COLOR }} />
          <span className="text-slate-300">⚠ Anomalia</span>
        </div>
      </div>

      {/* Toggle Zone */}
      <button
        onClick={() => setShowZones(z => !z)}
        title={showZones ? 'Nascondi zone' : 'Mostra zone'}
        className={`absolute bottom-3 right-3 flex items-center gap-2 px-4 py-2.5 text-sm font-bold border shadow-xl transition-all ${
          showZones
            ? 'bg-slate-800/95 text-emerald-400 border-emerald-500/40 hover:border-emerald-400'
            : 'bg-slate-900/90 text-slate-500 border-slate-700/50 hover:text-slate-300'
        }`}
        style={{ zIndex: 1000 }}
      >
        <span className="text-base">🗺️</span>
        <span>{showZones ? 'Zone ON' : 'Zone OFF'}</span>
        <span className="text-xs opacity-60 font-normal">
          {ZONES.length > 0 ? `${ZONES.length} POI` : '6 aree'}
        </span>
      </button>
    </div>
  )
}
