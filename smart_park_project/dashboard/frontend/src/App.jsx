import { useState, useEffect } from 'react'
import ParkMap from './components/ParkMap'
import StatusBar from './components/StatusBar'
import SentimentPanel from './components/SentimentPanel'
import SensorPanel from './components/SensorPanel'
import SensorList from './components/SensorList'
import { useDittoSSE } from './hooks/useDittoSSE'
import DittoQueryBuilder from './utils/DittoQueryBuilder'

export default function App() {
  const [initialPins, setInitialPins] = useState([])
  const [selectedSensor, setSelectedSensor] = useState(null)

  // SSE connette automaticamente e ascolta le "Change Notifications" in push
  const { things: sseThings, connected } = useDittoSSE()

  useEffect(() => {
    // 1. Caricamento Mappa (Search API + Fields Selector) tramite Builder
    const builder = new DittoQueryBuilder();
    
    // Recuperiamo solo i dispositivi che hanno le coordinate
    // e scarichiamo solo i campi necessari per il render della mappa
    builder
      .hasAttribute('lat')
      .selectFields(['thingId', 'attributes/lat', 'attributes/lng', 'attributes/name', 'features']);

    builder.execute()
      .then(data => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        const mapped = items.map(item => ({
          thingId: item.thingId,
          name: item.attributes?.name || item.thingId.split(':')[1],
          lat: item.attributes?.lat,
          lng: item.attributes?.lng,
          features: item.features || {}   // needed for type color before SSE snapshot arrives
        }))
        setInitialPins(mapped)
      })
      .catch(err => {
        console.error("Errore fetch Pin Mappa:", err)
        setInitialPins([
          { thingId: 'smartpark:sensor-01', name: 'Gigante 1', lat: 39.3245, lng: 16.4677},
          { thingId: 'smartpark:sensor-02', name: 'Gigante 2', lat: 39.3248, lng: 16.4679 },
        ])
      })
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-200">
      <StatusBar
        sseThings={sseThings}
        connected={connected}
        totalPins={initialPins.length}
      />

      <main className="flex-1 relative flex overflow-hidden">
        {/* Sidebar sinistra — lista sensori raggruppata per tipo */}
        <SensorList
          initialPins={initialPins}
          sseThings={sseThings}
          selectedSensor={selectedSensor}
          onSelectSensor={setSelectedSensor}
        />

        {/* Mappa centrale */}
        <div className="flex-1 h-full">
          <ParkMap
            initialPins={initialPins}
            sseThings={sseThings}
            selectedSensor={selectedSensor}
            onSelectSensor={setSelectedSensor}
          />
        </div>

        {/* Pannello dettaglio sensore — destra */}
        {selectedSensor && (
          <div className="w-80 h-full border-l border-slate-700 bg-slate-900 shadow-2xl z-10 overflow-y-auto">
            <SensorPanel
              sensorInfo={selectedSensor}
              liveData={sseThings[selectedSensor.thingId]}
              connected={connected}
              onClose={() => setSelectedSensor(null)}
            />
          </div>
        )}
      </main>

      <SentimentPanel />
    </div>
  )
}
