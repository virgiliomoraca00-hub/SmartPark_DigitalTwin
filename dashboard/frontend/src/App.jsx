import { useState } from 'react'
import { useMqtt } from './hooks/useMqtt'
import StatusBar from './components/StatusBar'
import ParkMap from './components/ParkMap'
import SensorPanel from './components/SensorPanel'
import SentimentPanel from './components/SentimentPanel'
import './index.css'

export default function App() {
  const { sensorData, connected } = useMqtt('ws://localhost:9001')
  const [selectedSensor, setSelectedSensor] = useState(null)

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-green-400 text-lg">🌲</span>
          <h1 className="text-white font-bold text-lg tracking-tight">Smart Park · Parco Nazionale della Sila</h1>
        </div>
        <span className="text-xs text-slate-500">Digital Twin Dashboard</span>
      </header>

      {/* Status bar metriche globali */}
      <StatusBar sensorData={sensorData} connected={connected} />

      {/* Contenuto principale */}
      <div className="flex flex-1 min-h-0">
        {/* Mappa */}
        <div className="flex-1 min-w-0">
          <ParkMap
            sensorData={sensorData}
            selectedSensor={selectedSensor}
            onSelectSensor={setSelectedSensor}
          />
        </div>

        {/* Pannello dettaglio sensore */}
        {selectedSensor && (
          <div className="w-[480px] shrink-0">
            <SensorPanel
              sensor={selectedSensor}
              currentData={sensorData[selectedSensor.id]}
              onClose={() => setSelectedSensor(null)}
            />
          </div>
        )}
      </div>

      {/* Pannello sentiment in fondo */}
      <div className="shrink-0">
        <SentimentPanel />
      </div>
    </div>
  )
}
