# 🌐 SmartPark — Broker MQTT Pubblico

## Credenziali di connessione

| Campo      | Valore                      |
|------------|-----------------------------|
| **Host**   | `4.tcp.eu.ngrok.io`         |
| **Porta**  | `19756`                     |
| **Auth**   | Nessuna (anonimo)           |
| **QoS**    | 0, 1 o 2                    |

---

## Struttura dei Topic

Pubblicate i vostri dati sul topic:

```
smartpark/<gruppo>/<sensore>
```

### Esempi:
```
smartpark/gruppo1/temperatura
smartpark/gruppo1/umidita
smartpark/gruppo2/parcheggio
smartpark/gruppo3/aria
```

### Formato del payload (JSON consigliato):
```json
{
  "value": 23.5,
  "unit": "°C",
  "timestamp": "2026-06-01T22:00:00Z"
}
```

---

## Esempi di codice

### Python (paho-mqtt)
```python
import paho.mqtt.client as mqtt
import json, time

client = mqtt.Client()
client.connect("4.tcp.eu.ngrok.io", 19756, 60)

while True:
    payload = json.dumps({"value": 23.5, "unit": "°C"})
    client.publish("smartpark/gruppo1/temperatura", payload)
    time.sleep(5)
```

Installa la libreria con:
```bash
pip install paho-mqtt
```

### Node.js (mqtt.js)
```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://4.tcp.eu.ngrok.io:19756');

client.on('connect', () => {
  setInterval(() => {
    const payload = JSON.stringify({ value: 23.5, unit: '°C' });
    client.publish('smartpark/gruppo1/temperatura', payload);
  }, 5000);
});
```

Installa con:
```bash
npm install mqtt
```

### Arduino / ESP32 (PubSubClient)
```cpp
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "4.tcp.eu.ngrok.io";
const int   mqtt_port   = 19756;

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  // ... WiFi setup ...
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) client.connect("gruppo1-device");
  client.publish("smartpark/gruppo1/temperatura", "23.5");
  delay(5000);
}
```

---

## ⚠️ Note importanti

- Il tunnel è **temporaneo**: l'URL e la porta cambiano ogni volta che viene riavviato.
  Contattare il team SmartPark se non riesce a connettersi.
- **Non pubblicare dati sensibili** — il broker è completamente pubblico.
- Usare un **Client ID univoco** per il vostro gruppo per evitare disconnessioni.
