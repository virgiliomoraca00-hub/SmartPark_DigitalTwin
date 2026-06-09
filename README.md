# Smart Park — Digital Twin IoT Stack

Sistema IoT per il monitoraggio di un parco naturale intelligente basato su **Eclipse Ditto** come motore di Digital Twin, **Mosquitto MQTT** come broker, **Node-RED** come simulatore sensori e una **dashboard React** in tempo reale con controllo bidirezionale dei dispositivi.

---

## Architettura

```
┌────────────────────────────────────────────────────────────────────┐
│                        SIMULAZIONE (Node-RED :1880)                │
│  Tab: Env Monitoring | Computer Vision | Sentiment | Activity Rec. │
│  Tab: HTTP→MQTT Bridge | Bidirectional Control                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ MQTT publish
                           ▼ smartpark/telemetry/<deviceId>
                    ┌──────────────┐
                    │  Mosquitto   │ :1883
                    │  MQTT Broker │
                    └──────┬───────┘
                           │ subscribe
            ┌──────────────┼─────────────────────────────┐
            ▼              ▼                              ▼
   ┌──────────────┐ ┌─────────────────────────────┐ ┌──────────────┐
   │  Telegraf    │ │    Ditto Connectivity        │ │  MQTT topics │
   │ MQTT→InfluxDB│ │  JavaScript Mapper           │ │  (debug)     │
   └──────┬───────┘ │  → Ditto Protocol Msg        │ └──────────────┘
          │         └─────────────┬───────────────┘
          ▼                       │ merge/create Things
   ┌──────────────┐    ┌──────────▼──────────────────┐
   │   InfluxDB   │    │   Eclipse Ditto              │
   │  :8086       │    │   (policies + things +       │
   └──────┬───────┘    │    search + connectivity +   │
          │            │    gateway)                  │
          ▼            └──────────┬──────────────────┘
   ┌──────────────┐               │ REST API + SSE
   │   Grafana    │    ┌──────────▼──────────────────┐
   │   :3000      │    │   Nginx reverse proxy        │
   └──────────────┘    │   Basic Auth (ditto/devops)  │
                       │   :8080                      │
                       └──────────┬──────────────────┘
                                  │
                       ┌──────────▼──────────────────┐
                       │   Dashboard React (Vite)     │
                       │   :5173                      │
                       │   useDittoSSE (snapshot+SSE) │
                       │   useDittoPatch (bidir)      │
                       └─────────────────────────────┘
```

### Flusso bidirezionale (App → Sensore)

```
Dashboard React
    │  PUT /api/2/things/<id>/features/sensors/desiredProperties/<key>
    ▼
Ditto REST API (via nginx :8080)
    │  emette evento twin/events su MQTT
    ▼ smartpark/events/<thingId>
Mosquitto
    │  subscribe smartpark/events/#
    ▼
Node-RED (tab "Bidirectional Control")
    │  global.set('state_<deviceId>', { key: value })
    ▼
Generator functions (inject loops)
    │  leggono global state e modificano la simulazione
    ▼
Sensore simulato aggiornato
```

---

## Servizi e porte

| Servizio              | Porta  | Credenziali               | Note                          |
|-----------------------|--------|---------------------------|-------------------------------|
| Ditto REST API        | 8080   | `ditto` / `ditto`         | Via nginx + Basic Auth        |
| Ditto Explorer UI     | 8081   | —                         | Interfaccia web Ditto         |
| Node-RED              | 1880   | —                         | Simulatore + bridge HTTP→MQTT |
| Mosquitto MQTT        | 1883   | —                         | No auth (rete Docker interna) |
| Mosquitto WebSocket   | 9001   | —                         |                               |
| InfluxDB UI           | 8086   | `admin` / `admin-secret`  | Time-series storage           |
| Grafana               | 3000   | `admin` / `admin`         | Dashboard storiche            |
| Dashboard React (dev) | 5173   | —                         | `npm run dev`                 |
| MongoDB               | 27017  | `ditto` / `ditto-secret`  | Persistence per Ditto         |

---

## Prerequisiti

| Strumento      | Versione minima |
|----------------|-----------------|
| Docker Engine  | 24+             |
| Docker Compose | v2              |
| Node.js        | 18+             |
| npm            | 9+              |

---

## Avvio

### 1. Crea le directory necessarie

```bash
mkdir -p mappers/commonjs
```

> `ditto-connectivity` monta questo volume in sola lettura per caricare il mapper JS compilato. La directory deve esistere prima di `docker compose up`.

### 2. Genera le credenziali nginx

```bash
# Linux / macOS (richiede apache2-utils: sudo apt install -y apache2-utils)
htpasswd -cb nginx/nginx.htpasswd ditto ditto
htpasswd -b  nginx/nginx.htpasswd devops devops
```

```powershell
# Windows PowerShell (come Amministratore)
$hash  = & docker run --rm httpd:alpine htpasswd -nbB ditto  ditto
$hash2 = & docker run --rm httpd:alpine htpasswd -nbB devops devops
"ditto:$hash`ndevops:$hash2" | Out-File -Encoding ascii nginx\nginx.htpasswd
```

### 3. Avvia lo stack Docker

```bash
docker compose up -d
```

> Al primo avvio attendere 2-3 minuti per l'inizializzazione del cluster Pekko/Akka di Ditto.

### 4. Configura Eclipse Ditto

Dopo che lo stack è up, esegui lo script di setup per creare la policy e la connessione MQTT:

```bash
# Linux / macOS
bash ditto/setup.sh

# Con reset (elimina e ricrea policy e connessione esistenti)
bash ditto/setup.sh --reset
```

```powershell
# Windows
.\ditto\setup.ps1
.\ditto\setup.ps1 -Reset
```

Lo script esegue:
1. Attende che Ditto risponda (poll attivo, max 150s)
2. Crea / aggiorna la policy `smartpark:sensors-policy`
3. Crea / aggiorna la connessione MQTT `smartpark-mqtt-connection`
4. Verifica lo stato della connessione
5. Smoke test opzionale (se `mosquitto_pub` è disponibile)

### 5. Avvia la dashboard React

```bash
cd dashboard/frontend
npm install      # solo al primo avvio o dopo aggiornamenti
npm run dev
```

La dashboard sarà disponibile su **http://localhost:5173**.

> Se `vite` non è eseguibile dopo `npm install`, esegui `chmod +x node_modules/.bin/*`.

### 6. Verifica stato container

```bash
docker compose ps
```

Tutti i servizi devono risultare `healthy` o `Up`. I servizi Ditto impiegano ~2 minuti prima di diventare `healthy`.

---

## Tipi di sensori simulati (Node-RED)

Node-RED espone 6 tab di flow, ognuna con i propri nodi inject che pubblicano su `smartpark/telemetry/<deviceId>`:

| Tab Node-RED              | Tipo (`attributes.type`) | Device ID prefix | Intervallo |
|---------------------------|--------------------------|------------------|------------|
| Env Monitoring            | `environmental`          | `env-1xx`        | 12s        |
| Computer Vision           | `vision`                 | `cam-2xx`        | 6s         |
| Sentiment Analysis        | `sentimentAnalysis`      | `mic-3xx`        | 8s         |
| Activity Recognition      | `activityRecognition`    | `shimmer-visitor-01/02` | 2s |
| HTTP → MQTT Bridge        | `environmental`          | `env-<id>`       | Su richiesta HTTP POST |
| Bidirectional Control     | (listener)               | —                | Evento-driven |

### Struttura payload MQTT (formato attuale)

```json
{
  "device_id": "env-101",
  "type": "environmental",
  "features": {
    "sensors": {
      "properties": {
        "temperature": 22.4,
        "humidity": 58.1,
        "pressure": 101325,
        "noise": 42.3,
        "light": 65,
        "anomaly_detected": false
      },
      "desiredProperties": {}
    },
    "motion": {
      "properties": { "tof": 320, "angle": 1.2, "accX": 0.01 }
    },
    "gateway": {
      "properties": { "EG5120_CPU_Temperature": 45, "EG5120_CPU_status": "NORMAL" }
    }
  },
  "attributes": { "lat": 39.3241, "lng": 16.4678 },
  "timestamp": "2026-06-09T10:00:00.000Z"
}
```

Il mapper accetta anche il formato legacy con `"data": { ... }` al posto di `"features"`.

---

## Eclipse Ditto — Mapper JavaScript

La connessione MQTT (`smartpark-mqtt-connection`) usa un **mapper JavaScript custom** per tradurre i messaggi MQTT in Ditto Protocol Messages e viceversa.

### Script inbound (`incomingScript`)

Riceve il payload MQTT grezzo e produce un `merge` command sul Digital Twin:

- Estrae `deviceId` dall'ultimo segmento del topic MQTT (es. `smartpark/telemetry/env-101` → `env-101`)
- Mappa `attributes` del payload in attributi Ditto
- Se il payload ha `features` (formato nuovo), li passa direttamente
- Se il payload ha `data` (formato legacy), lo converte in `features/sensors/properties`
- Supporta anche `motion` e `gateway` come feature separate
- Usa `Ditto.buildDittoProtocolMsg` con `merge` command e `policyId: smartpark:sensors-policy`
- I Things vengono creati automaticamente al primo messaggio (**ImplicitThingCreation**)

### Script outbound (`outgoingScript`)

Converte gli eventi Ditto in messaggi MQTT pubblicati su `smartpark/events/<thingId>`:

- Filtra solo gli eventi che coinvolgono `desiredProperties` (modifiche di controllo)
- Pubblica un payload JSON con `{ thingId, path, data, success, status }`
- Gli altri eventi twin (telemetria) vengono ignorati (`return null`)

---

## Bidirezionalità — Controllo App → Sensore

Il sistema supporta il controllo in tempo reale dei sensori simulati dalla dashboard. Ogni sensore espone **desiredProperties** modificabili tramite UI.

### Flusso tecnico completo

#### 1. Dashboard invia il comando

`useDittoPatch.js` esegue una `PUT` sulla REST API di Ditto:

```
PUT /api/2/things/smartpark:<deviceId>/features/sensors/desiredProperties/<key>
Authorization: Basic ZGl0dG86ZGl0dG8=
Content-Type: application/json

<value>
```

Esempio: attivare lo stato di allerta su una camera

```
PUT /api/2/things/smartpark:cam-201/features/sensors/desiredProperties/alert_active
Content-Type: application/json

true
```

#### 2. Ditto emette un evento MQTT

La connessione `smartpark-mqtt-connection` ha un **target** configurato su `smartpark/events/{{ thing:id }}` per il topic `_/_/things/twin/events`. L'`outgoingScript` filtra solo gli eventi relativi a `desiredProperties` e pubblica:

```json
{
  "thingId": "smartpark:cam-201",
  "path": "/features/sensors/desiredProperties/alert_active",
  "data": true,
  "success": true,
  "status": 200
}
```

sul topic: `smartpark/events/smartpark:cam-201`

#### 3. Node-RED intercetta l'evento

Il tab **"Bidirectional Control"** contiene:
- Un nodo `mqtt in` in ascolto su `smartpark/events/#`
- Una function `Store desired state` che estrae `thingId`, `path` e `data` e salva il valore in `global.set('state_<deviceId>', { key: value })`

#### 4. I generator applicano lo stato

I nodi function di simulazione leggono lo stato globale all'inizio di ogni ciclo:

```javascript
var _state = global.get('state_' + sensor.device_id) || {};
var alertActive = _state.alert_active !== undefined
  ? _state.alert_active
  : global.get('alert_active') || false;
```

Il comportamento simulato cambia di conseguenza (es. `alert_active: true` → temperature alte, anomalie, sentiment negativo).

### Proprietà controllabili per tipo sensore

| Chiave desiredProperty      | Tipo sensore      | Widget UI  | Descrizione                              |
|-----------------------------|-------------------|------------|------------------------------------------|
| `alert_active`              | Tutti             | Toggle     | Attiva simulazione di emergenza          |
| `sampling_rate_s`           | Environmental     | Slider     | Intervallo campionamento (5-300s)        |
| `alert_threshold_temp`      | Environmental     | Slider     | Soglia temperatura allerta (20-80°C)     |
| `tracking_mode`             | Vision            | Select     | person / crowd / anomaly / disabled      |
| `confidence_threshold`      | Vision            | Slider     | Soglia confidenza AI (0.5-1.0)           |
| `night_mode`                | Vision            | Toggle     | Filtro infrarosso                        |
| `frame_rate_fps`            | Vision            | Slider     | Frame rate (1-30 fps)                    |
| `sensitivity`               | sentimentAnalysis | Slider     | Sensibilità microfono (0.0-1.0)          |
| `noise_threshold_db`        | sentimentAnalysis | Slider     | Soglia rumore allerta (40-100 dB)        |
| `sampling_rate_hz`          | activityRecognition | Slider   | Frequenza IMU (1-50 Hz)                  |
| `vibration_alert_enabled`   | activityRecognition | Toggle   | Abilita alert vibrazione                 |
| `vibration_threshold`       | activityRecognition | Slider   | Soglia vibrazione (0.5-10 g)             |

> Le desiredProperties compaiono nel pannello **"Controllo"** del SensorPanel solo se il sensore le pubblica nel payload (nel campo `features/sensors/desiredProperties`). Attualmente i flow Node-RED le includono con oggetto vuoto `{}` — per esporre i controlli nella UI, rimuovi il commento dai campi `desiredProperties` nella function del sensore corrispondente.

### HTTP → MQTT Bridge (Gateway EG5120)

Node-RED espone un endpoint HTTP per ricevere dati dal gateway industriale Robustel EG5120:

```
POST http://localhost:1880/sensors/env
Content-Type: application/json

{
  "device_id": "42",
  "latitude": 39.3241,
  "longitude": 16.4678,
  "temperature": 24.5,
  "humidity": 61.0,
  "timestamp": "2026-06-09T10:00:00Z"
}
```

La function `→ SmartPark format (generic)`:
- Prefissa `device_id` con `env-` (produce `env-42`)
- Normalizza i nomi campo (es. `temperatura` → `temperature_c`)
- Sposta `latitude`/`longitude` in `attributes.lat`/`attributes.lng`
- Pubblica su `smartpark/telemetry/env-42`
- Risponde HTTP 202 con `{ ok: true, device_id, topic, fields }`

---

## Policy Ditto

La policy `smartpark:sensors-policy` concede all'utente `nginx:ditto` accesso completo (READ+WRITE) su Things, Policy e Messages:

```json
{
  "entries": {
    "owner": {
      "subjects": { "nginx:ditto": { "type": "nginx basic auth user" } },
      "resources": {
        "thing:/":   { "grant": ["READ", "WRITE"] },
        "policy:/":  { "grant": ["READ", "WRITE"] },
        "message:/": { "grant": ["READ", "WRITE"] }
      }
    }
  }
}
```

L'utente `nginx:ditto` corrisponde all'autenticazione Basic Auth con username `ditto` passata da nginx tramite l'header `x-ditto-pre-authenticated`.

---

## Dashboard React — Architettura frontend

```
src/
├── App.jsx                  # Radice: stato globale, filtri tipo/metrica
├── components/
│   ├── ParkMap.jsx          # Mappa Leaflet con pin colorati per tipo
│   ├── SensorList.jsx       # Lista sensori con filtro tipo e metrica
│   ├── SensorPanel.jsx      # Pannello dettaglio: metriche + controllo
│   ├── StatusBar.jsx        # Barra stato: SSE connected, contatori
│   ├── AdvancedMonitoring.jsx # Iframe Grafana filtrato per sensore
│   ├── SentimentPanel.jsx   # Vista sentiment audio
│   └── SentimentPopup.jsx   # Popup analisi sentiment
├── hooks/
│   ├── useDittoSSE.js       # Snapshot HTTP + stream SSE Things
│   ├── useDittoPatch.js     # PUT desiredProperties (controllo bidir.)
│   └── useSensorTD.js       # Fetch Thing Description (WoT-like)
├── utils/
│   ├── DittoQueryBuilder.js # Builder query Search API con paginazione cursore
│   ├── thingSchema.js       # Schema validazione Thing
│   └── zoneConfig.js        # Configurazione zone mappa
└── config/
    └── sensorConfig.js      # Icone, colori, metadati metriche e desiredProperties
```

### useDittoSSE — Caricamento ibrido

1. **Snapshot iniziale**: scarica tutti i Things via `GET /ditto/2/search/things` con paginazione automatica (cursore, max 200 per pagina) tramite `DittoQueryBuilder.executeAll()`
2. **Stream live**: apre `GET /ditto/2/things` con `Accept: text/event-stream` per ricevere eventi `created`, `modified`, `deleted` in tempo reale
3. **Deep-merge features**: gli eventi SSE possono essere parziali; la funzione `deepMergeFeatures` preserva le feature non menzionate nell'evento

### Proxy Vite

```javascript
'/ditto' → 'http://localhost:8080/api'   // Ditto REST API
'/api'   → 'http://localhost:8000'       // (riservato, non usato)
```

---

## Telegraf — Bridge MQTT → InfluxDB

Telegraf si iscrive a `smartpark/telemetry/#` e scrive i dati nel bucket `sensor-data` di InfluxDB:

- **Measurement**: `sensor_reading`
- **Tags**: `device_id`, `type`
- **Timestamp**: dal campo `timestamp` del payload JSON
- **Fields**: tutti i campi numerici/stringa del payload

---

## Struttura del progetto

```
smart_park_project/
├── docker-compose.yml              # Stack completo (14 servizi)
├── README.md
├── MQTT_PUBLIC_BROKER.md           # Note broker MQTT pubblico
├── start-mqtt-tunnel.ps1           # Script tunnel MQTT per Windows
├── nginx/
│   ├── nginx.conf                  # Reverse proxy + CORS + Basic Auth
│   └── nginx.htpasswd              # Credenziali (ditto, devops)
├── mosquitto/config/
│   └── mosquitto.conf              # Configurazione broker MQTT
├── ditto/
│   ├── setup.sh                    # Setup Ditto (Linux/macOS)
│   ├── setup.ps1                   # Setup Ditto (Windows)
│   ├── policies/
│   │   ├── smartpark-sensors-policy.json
│   │   └── smart-park-policy.json  # (legacy)
│   └── connections/
│       └── mqtt-connection.json    # Connessione MQTT + mapper JS
├── mappers/
│   └── commonjs/                   # Output mapper JS (montato da ditto-connectivity)
├── dashboard/
│   └── frontend/                   # React + Vite + Tailwind + Leaflet
│       ├── src/
│       ├── vite.config.js          # Proxy /ditto → :8080/api
│       └── package.json
├── nodered_data/
│   ├── flows.json                  # Flow simulazione sensori
│   ├── flows_http_bridge.json      # Flow bridge HTTP→MQTT (backup)
│   └── settings.js
├── grafana/provisioning/
│   ├── dashboards/                 # Dashboard pre-configurate
│   └── datasources/
│       └── influxdb.yaml           # Datasource InfluxDB
├── telegraf/
│   └── telegraf.conf               # Bridge MQTT → InfluxDB
├── data/
│   └── admin-ui.html               # UI amministrazione (smartpark-api)
└── scripts/                        # Utility scripts Node.js
    ├── query.js
    ├── rebuild-flows-bidirectional.js
    └── ...
```

---

## Verifica rapida dello stack

```bash
# Ditto risponde
curl -u ditto:ditto http://localhost:8080/api/2/things

# Lista Digital Twin presenti
curl -u ditto:ditto "http://localhost:8080/api/2/search/things?option=size(20)"

# Stato connessione MQTT
curl -u devops:devops http://localhost:8080/api/2/connections/smartpark-mqtt-connection/status

# Test controllo bidirezionale: attiva allerta su un sensore
curl -u ditto:ditto \
  -X PUT "http://localhost:8080/api/2/things/smartpark:cam-201/features/sensors/desiredProperties/alert_active" \
  -H "Content-Type: application/json" \
  -d "true"
```

---

## Reset e pulizia

```bash
# Ferma i container (i dati sono preservati nei volumi Docker)
docker compose down

# Ferma e rimuovi TUTTI i dati (reset completo dei volumi)
docker compose down -v

# Dopo il reset, eseguire nuovamente i passi 1-4 della sezione Avvio
```

---

## Troubleshooting

### Ditto non risponde su :8080

```bash
docker compose logs ditto-gateway --tail=50
docker compose logs nginx --tail=20
```

Attendere almeno 2 minuti dall'avvio. Il cluster Pekko/Akka di Ditto impiega tempo per stabilizzarsi.

### I pin non compaiono sulla dashboard

1. Verifica che i Things esistano in Ditto:
   ```bash
   curl -u ditto:ditto "http://localhost:8080/api/2/search/things?option=size(5)"
   ```
2. Se `items: []`, i messaggi MQTT non arrivano. Controlla Node-RED:
   ```bash
   docker compose logs smart_park_project-nodered-1 --tail=30
   ```
3. Verifica che i nodi inject abbiano `repeat` configurato (es. `8`, `6`, `12`, `2`). Se è vuoto, aprire http://localhost:1880 e configurarli manualmente, oppure modificare `nodered_data/flows.json`.

### Il controllo bidirezionale non aggiorna il sensore

1. Verifica che l'evento MQTT venga emesso da Ditto:
   ```bash
   # Iscriviti ai topic eventi con mosquitto_sub
   mosquitto_sub -h localhost -p 1883 -t "smartpark/events/#" -v
   ```
2. Verifica che Node-RED riceva l'evento (tab "Bidirectional Control" → debug node)
3. Controlla che `outgoingScript` del mapper non filtri l'evento — deve contenere `desiredProperties` nel path

### Credenziali nginx errate (HTTP 401)

```bash
htpasswd -cb nginx/nginx.htpasswd ditto ditto
htpasswd -b  nginx/nginx.htpasswd devops devops
docker compose restart nginx
```

### I Digital Twin non vengono creati dai messaggi MQTT

```bash
# Verifica connessione Ditto↔Mosquitto
curl -u devops:devops http://localhost:8080/api/2/connections/smartpark-mqtt-connection/status

# Log Ditto Connectivity
docker compose logs ditto-connectivity --tail=100

# Log Mosquitto (deve mostrare PUBLISH da nodered-smartpark)
docker compose logs mosquitto --tail=30
```

### ditto-connectivity non si avvia (volume mappers mancante)

```bash
mkdir -p mappers/commonjs
docker compose restart ditto-connectivity
```
