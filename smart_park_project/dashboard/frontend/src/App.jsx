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
  const [preselectedThingId, setPreselectedThingId] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)    // null = tutti
  const [metricFilter, setMetricFilter] = useState(null) // null = nessuna metrica attiva

  // Apre il Monitoraggio Avanzato pre-filtrato su un sensore specifico
  const handleOpenAdvancedForSensor = (thingId) => {
    setPreselectedThingId(thingId)
    setAdvancedOpen(true)
  }

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

  // Tipi disponibili derivati dinamicamente dai pin con coordinate
  const availableTypes = useMemo(() => {
    const types = new Set()
    initialPins.forEach(p => {
      const type = p.attributes?.type
      if (type) types.add(type)
    })
    return Array.from(types).sort()
  }, [initialPins])

  // Pin filtrati per tipo — se typeFilter è null mostra tutti
  const visiblePins = useMemo(() =>
    typeFilter
      ? initialPins.filter(p => p.attributes?.type === typeFilter)
      : initialPins
  , [initialPins, typeFilter])

  // Chiavi da escludere dalle metriche (metadati di sistema, non telemetria e doppioni legacy)
  const METRIC_EXCLUDED = new Set([
    'lat', 'lng', 'timestamp', 'device_id', 'type',
    'name', 'zone', 'thingId', 'location', 'activity',
    // Rimuoviamo i doppioni causati dai vecchi log prima della standardizzazione
    'temperatura', 'umidita', 'umidità',
    'rumore', 'pressione', 'luminosita', 'luminosità'
  ])

  // Metriche disponibili per il tipo selezionato — unione di tutte le feature props
  // dei sensori di quel tipo, senza ripetizioni. Aggiornato live con SSE.
  const availableMetrics = useMemo(() => {
    if (!typeFilter) return []
    const keys = new Set()
    Object.values(sseThings)
      .filter(t => t.attributes?.type === typeFilter)
      .forEach(t => {
        for (const featVal of Object.values(t.features || {})) {
          for (const key of Object.keys(featVal?.properties || {})) {
            const normalized = key.replace(/^data_/, '')
            if (!METRIC_EXCLUDED.has(normalized)) keys.add(normalized)
          }
        }
      })
    return Array.from(keys).sort()
  }, [sseThings, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambiare tipo azzera la metrica e la selezione sensore
  const handleTypeFilter = (type) => {
    setTypeFilter(prev => prev === type ? null : type)
    setSelectedSensor(null)
    setMetricFilter(null)
  }

  const handleMetricFilter = (metric) => {
    setMetricFilter(prev => prev === metric ? null : metric)
  }

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
        <AdvancedMonitoring
          onClose={() => { setAdvancedOpen(false); setPreselectedThingId(null) }}
          sseThings={sseThings}
          preselectedThingId={preselectedThingId}
        />
      )}

      {sentimentOpen && (
        <SentimentPopup
          audioSensors={audioSensors}
          onClose={() => setSentimentOpen(false)}
        />
      )}

      <main className="flex-1 relative flex overflow-hidden">
        <SensorList
          initialPins={visiblePins}
          sseThings={sseThings}
          selectedSensor={selectedSensor}
          onSelectSensor={setSelectedSensor}
          typeFilter={typeFilter}
          availableTypes={availableTypes}
          onTypeFilter={handleTypeFilter}
          availableMetrics={availableMetrics}
          metricFilter={metricFilter}
          onMetricFilter={handleMetricFilter}
        />

        <div className="flex-1 h-full">
          <ParkMap
            initialPins={visiblePins}
            sseThings={sseThings}
            selectedSensor={selectedSensor}
            onSelectSensor={setSelectedSensor}
            metricFilter={metricFilter}
          />
        </div>

        {selectedSensor && (
          <div className="w-[620px] h-full border-l border-slate-700 bg-slate-900 shadow-2xl z-10 overflow-y-auto">
            <SensorPanel
              sensorInfo={selectedSensor}
              liveData={sseThings[selectedSensor.thingId]}
              connected={connected}
              onClose={() => setSelectedSensor(null)}
              onOpenAdvanced={handleOpenAdvancedForSensor}
            />
          </div>
        )}
      </main>
    </div>
  )
}
