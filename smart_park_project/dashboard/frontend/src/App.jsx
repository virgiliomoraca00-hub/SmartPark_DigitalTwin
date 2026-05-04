import { useState, useMemo } from 'react'
import ParkMap from './components/ParkMap'
import StatusBar from './components/StatusBar'
import SentimentPopup from './components/SentimentPopup'
import SensorPanel from './components/SensorPanel'
import SensorList from './components/SensorList'
import AdvancedMonitoring from './components/AdvancedMonitoring'
import { useDittoSSE } from './hooks/useDittoSSE'

export default function App() {
  const [selectedSensor, setSelectedSensor] = useState(null)
  const [sentimentOpen, setSentimentOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { things: sseThings, connected } = useDittoSSE()

  // Pin mappa derivati direttamente da sseThings — nessun fetch separato
  // I sensori fissi hanno lat/lng in attributes (es. environmental, camera)
  // I wearable (activityRecognition) hanno lat/lng in features/sensors/properties → flattati in top-level da processPayload
  const initialPins = useMemo(() => {
    return Object.values(sseThings)
      .filter(t => {
        const lat = t.attributes?.lat ?? t.lat ?? t.features?.sensors?.properties?.lat
        const lng = t.attributes?.lng ?? t.lng ?? t.features?.sensors?.properties?.lng
        return lat != null && lng != null
      })
      .map(t => ({
        thingId: t.thingId,
        name: t.attributes?.name || t.thingId.split(':')[1],
        lat: t.attributes?.lat ?? t.lat ?? t.features?.sensors?.properties?.lat,
        lng: t.attributes?.lng ?? t.lng ?? t.features?.sensors?.properties?.lng,
        attributes: t.attributes || {},
        features: t.features || {}
      }))
  }, [sseThings])

  const audioSensors = Object.values(sseThings).filter(d =>
    d.attributes?.type === 'audio' || d.attributes?.type === 'sentimentAnalysis'
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-200">
      <StatusBar
        sseThings={sseThings}
        connected={connected}
        totalPins={initialPins.length}
        onSentimentToggle={() => setSentimentOpen(o => !o)}
        sentimentOpen={sentimentOpen}
        onAdvancedToggle={() => setAdvancedOpen(o => !o)}
        advancedOpen={advancedOpen}
      />

      {advancedOpen && (
        <AdvancedMonitoring onClose={() => setAdvancedOpen(false)} />
      )}

      {sentimentOpen && (
        <SentimentPopup
          audioSensors={audioSensors}
          onClose={() => setSentimentOpen(false)}
        />
      )}

      <main className="flex-1 relative flex overflow-hidden">
        <SensorList
          initialPins={initialPins}
          sseThings={sseThings}
          selectedSensor={selectedSensor}
          onSelectSensor={setSelectedSensor}
        />

        <div className="flex-1 h-full">
          <ParkMap
            initialPins={initialPins}
            sseThings={sseThings}
            selectedSensor={selectedSensor}
            onSelectSensor={setSelectedSensor}
          />
        </div>

        {selectedSensor && (
          <div className="w-[620px] h-full border-l border-slate-700 bg-slate-900 shadow-2xl z-10 overflow-y-auto">
            <SensorPanel
              sensorInfo={selectedSensor}
              liveData={sseThings[selectedSensor.thingId]}
              connected={connected}
              onClose={() => setSelectedSensor(null)}
            />
          </div>
        )}
      </main>
    </div>
  )
}
