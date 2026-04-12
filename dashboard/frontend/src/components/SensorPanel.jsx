import { useState } from 'react'
import { getMetricColor } from '../data/sensors'

const GRAFANA_URL = 'http://localhost:3000'
const DASHBOARD_UID = 'smart-park-v1'

const METRIC_PANELS_SENSOR = [
  { key: 'temperature', label: 'Temperatura', panelId: 20 },
  { key: 'humidity',    label: 'Umidità',     panelId: 21 },
  { key: 'air_quality', label: 'CO₂',         panelId: 22 },
  { key: 'motion',      label: 'Persone',     panelId: 23 },
  { key: 'noise',       label: 'Rumore',      panelId: 24 },
]

const METRIC_PANELS_ZONE = [
  { key: 'temperature', label: 'Temperatura', panelId: 10 },
  { key: 'humidity',    label: 'Umidità',     panelId: 11 },
  { key: 'air_quality', label: 'CO₂',         panelId: 12 },
  { key: 'motion',      label: 'Persone',     panelId: 13 },
  { key: 'noise',       label: 'Rumore',      panelId: 14 },
]

const CURRENT_METRICS = [
  { key: 'temperature', label: 'Temperatura', unit: '°C'  },
  { key: 'humidity',    label: 'Umidità',     unit: '%'   },
  { key: 'air_quality', label: 'CO₂',         unit: 'ppm' },
  { key: 'motion',      label: 'Persone',     unit: ''    },
  { key: 'noise',       label: 'Rumore',      unit: 'dB'  },
]

function grafanaUrl(panelId, sensorId = null) {
  const params = new URLSearchParams({
    orgId: 1,
    panelId,
    refresh: '5s',
    theme: 'light',
    from: 'now-30m',
    to: 'now',
  })
  if (sensorId) params.append('var-sensor_id', sensorId)
  return `${GRAFANA_URL}/d-solo/${DASHBOARD_UID}?${params}`
}

export default function SensorPanel({ sensor, currentData, onClose }) {
  const [view, setView] = useState('sensor') // 'sensor' | 'zone'

  if (!sensor) return null

  const data = currentData || {}
  const panels = view === 'sensor' ? METRIC_PANELS_SENSOR : METRIC_PANELS_ZONE
  const sensorId = view === 'sensor' ? sensor.id : null

  return (
    <div className="flex flex-col h-full bg-white border-l border-stone-200 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-stone-200">
        <div>
          <h2 className="text-stone-800 font-semibold text-base">{sensor.name}</h2>
          <p className="text-stone-400 text-xs mt-0.5">
            {sensor.id} · Zona {sensor.zone}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-stone-700 transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Valori correnti */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-stone-200">
        {CURRENT_METRICS.map(m => (
          <div key={m.key} className="bg-stone-50 rounded-lg p-2.5 border border-stone-100">
            <p className="text-stone-400 text-xs">{m.label}</p>
            <p className={`text-base font-bold ${getMetricColor(m.key, data[m.key])}`}>
              {data[m.key] != null ? `${Number(data[m.key]).toFixed(1)}${m.unit}` : '—'}
            </p>
          </div>
        ))}
        <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-100">
          <p className="text-stone-400 text-xs">Anomalia</p>
          <p className={`text-base font-bold ${data.anomaly ? 'text-red-500' : 'text-green-500'}`}>
            {data.anomaly != null ? (data.anomaly ? 'Sì' : 'No') : '—'}
          </p>
        </div>
      </div>

      {/* Toggle sensore / zona */}
      <div className="flex gap-1 px-4 pt-3">
        <button
          onClick={() => setView('sensor')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
            view === 'sensor'
              ? 'bg-stone-800 text-white'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          Questo sensore
        </button>
        <button
          onClick={() => setView('zone')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
            view === 'zone'
              ? 'bg-stone-800 text-white'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          Zona {sensor.zone}
        </button>
      </div>

      {/* Grafici Grafana */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">
          Serie temporali · ultimi 30 min
        </p>
        {panels.map(m => (
          <div key={m.key}>
            <p className="text-xs text-stone-500 mb-1">{m.label}</p>
            <iframe
              src={grafanaUrl(m.panelId, sensorId)}
              className="w-full rounded border border-stone-200"
              height="220"
              title={m.label}
            />
          </div>
        ))}
      </div>

      {data.timestamp && (
        <div className="px-4 pb-3 text-xs text-stone-400 border-t border-stone-100 pt-2">
          Aggiornato: {new Date(data.timestamp).toLocaleTimeString('it-IT')}
        </div>
      )}
    </div>
  )
}
