import { Fragment } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polygon } from 'react-leaflet'
import { getTypeConfig, sensorTypesMap } from '../config/sensorConfig'
import 'leaflet/dist/leaflet.css'

const ANOMALY_COLOR = '#ef4444'
const LEGEND_TYPES = ['environmental', 'camera', 'audio', 'wearable']

export default function ParkMap({ initialPins = [], sseThings = {}, selectedSensor, onSelectSensor }) {
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
            </Fragment>
          )
        })}
      </MapContainer>

      {/* Legenda per tipo */}
      <div className="absolute bottom-3 left-3 bg-slate-900/90 rounded-xl p-3 border border-slate-700/50 text-xs shadow-xl" style={{ zIndex: 1000 }}>
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tipo Sensore</p>
        {LEGEND_TYPES.map(type => {
          const cfg = sensorTypesMap[type]
          return (
            <div key={type} className="flex items-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: cfg.color }} />
              <span className="text-slate-400">{cfg.mapMarkerIcon} {cfg.label}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50">
          <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: ANOMALY_COLOR }} />
          <span className="text-slate-400">⚠ Anomalia</span>
        </div>
      </div>
    </div>
  )
}
