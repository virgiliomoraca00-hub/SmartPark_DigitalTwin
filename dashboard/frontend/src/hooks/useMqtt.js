import { useEffect, useState, useRef } from 'react'
import mqtt from 'mqtt'

export function useMqtt(brokerUrl = 'ws://localhost:9001') {
  const [sensorData, setSensorData] = useState({})
  const [connected, setConnected] = useState(false)
  const clientRef = useRef(null)

  useEffect(() => {
    const client = mqtt.connect(brokerUrl, {
      clientId: `smart-park-dashboard-${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 3000,
    })

    client.on('connect', () => {
      setConnected(true)
      client.subscribe('smart-park/+/telemetry')
    })

    client.on('disconnect', () => setConnected(false))
    client.on('error', () => setConnected(false))

    client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString())
        const sensorId = payload.sensor_id || topic.split('/')[1]
        setSensorData(prev => ({ ...prev, [sensorId]: payload }))
      } catch {
        // ignora messaggi malformati
      }
    })

    clientRef.current = client
    return () => client.end()
  }, [brokerUrl])

  return { sensorData, connected }
}
