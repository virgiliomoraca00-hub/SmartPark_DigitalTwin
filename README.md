# Smart Park — Digital Twin IoT Stack

Sistema IoT per il monitoraggio in tempo reale della Riserva Statale "I Giganti della Sila" (Calabria), costruito su **Eclipse Ditto** come motore di Digital Twin, **Mosquitto MQTT**, **Node-RED** come simulatore sensori e una **dashboard React** in tempo reale.

---

## Indice

1. [Panoramica del Progetto](#panoramica-del-progetto)
2. [Architettura dei Servizi](#architettura-dei-servizi)
3. [Flusso dei Dati — End to End](#flusso-dei-dati--end-to-end)
4. [Simulazione Sensori (Node-RED)](#simulazione-sensori-node-red)
5. [Mapper JavaScript Ditto](#mapper-javascript-ditto)
6. [Persistenza Storica (Telegraf → InfluxDB → Grafana)](#persistenza-storica-telegraf--influxdb--grafana)
7. [Dashboard React — Architettura Frontend](#dashboard-react--architettura-frontend)
8. [Struttura del Progetto](#struttura-del-progetto)
9. [Prerequisiti e Avvio](#prerequisiti-e-avvio)
10. [Configurazione Eclipse Ditto](#configurazione-eclipse-ditto)
11. [Interfacce Web](#interfacce-web)
12. [Troubleshooting](#troubleshooting)

---

## Panoramica del Progetto

Smart Park è un sistema di monitoraggio ambientale e comportamentale per aree naturali protette. Ogni dispositivo fisico (sensore ambientale, telecamera AI, microfono, wearable GPS) ha un corrispondente **Digital Twin** in Eclipse Ditto che ne mantiene lo stato aggiornato in tempo reale.

La dashboard React si connette direttamente a Ditto via **Server-Sent Events (SSE)** e mostra i dati senza alcun backend intermedio. Per le serie storiche, Grafana legge da InfluxDB che riceve i dati via Telegraf.

### Tipi di sensori simulati

| Tipo | `attributes.type` | Sensori simulati | Dati prodotti |
|------|-------------------|------------------|---------------|
| Ambientale | `environmental` | `env-100`…`env-109` (10 sensori, ogni 2s) | Temperatura, umidità, pressione, CO₂ |
| Computer Vision | `vision` / `camera` | `cam-200`…`cam-206` (7 camere, ogni 6s) | Persone rilevate, densità folla, anomalia, emozione |
| Analisi Audio | `audio` / `sentimentAnalysis` | `mic-300`…`mic-319` (20 microfoni, ogni 8s) | Sentiment score, livello rumore, trascrizione |
| Wearable GPS | `activityRecognition` | `shimmer-visitor-02`, `04`, `05` (ogni 1-2s) | Heart rate, GSR, passi, posizione GPS live |

---

## Architettura dei Servizi

```
┌──────────────────────────────────────────────────────────────────────┐
│                         SORGENTI DATI                                │
│                                                                      │
│  Node-RED (flows JSON) — simula tutti i sensori                      │
│  └─ pubblica MQTT su:  smartpark/telemetry/<device_id>               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ MQTT (porta 1883)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    MOSQUITTO — MQTT Broker                           │
│  Porta 1883 (MQTT TCP) | Porta 9001 (WebSocket)                     │
│  Broker centrale: tutti i publisher e subscriber passano da qui      │
└────────────────┬────────────────────────────────┬────────────────────┘
                 │                                │
                 │ Subscribe: smartpark/telemetry/# │ Subscribe: smartpark/telemetry/#
                 ▼                                ▼
┌─────────────────────────────┐    ┌─────────────────────────────────┐
│  DITTO CONNECTIVITY         │    │  TELEGRAF                       │
│  - Riceve messaggi MQTT     │    │  - Riceve messaggi MQTT         │
│  - Mappa payload JSON →     │    │  - Fa parsing JSON (tag:        │
│    Ditto Protocol (merge)   │    │    device_id, type)             │
│  - Crea/aggiorna Digital    │    │  - Scrive su InfluxDB ogni 5s   │
│    Twin automaticamente     │    └──────────────┬──────────────────┘
└──────────────┬──────────────┘                   │
               │                                  ▼
               ▼                    ┌─────────────────────────────────┐
┌──────────────────────────────┐    │  INFLUXDB v2                    │
│  ECLIPSE DITTO               │    │  Bucket: sensor-data            │
│  (5 microservizi + nginx)    │    │  Measurement: sensor_reading    │
│                              │    │  Tag: device_id, type           │
│  Policies → accessi          │    │  Fields: data.temperature_c,    │
│  Things   → stato twin       │    │          data.humidity_pct …    │
│  Search   → query RQL        │    └──────────────┬──────────────────┘
│  Connectivity → MQTT bridge  │                   │
│  Gateway  → HTTP/SSE API     │                   ▼
│  nginx    → auth porta 8080  │    ┌─────────────────────────────────┐
└──────────────┬───────────────┘    │  GRAFANA                        │
               │                    │  Porta 3000                     │
               │ SSE + REST API     │  Dashboard pre-configurate      │
               │ (porta 8080)       │  Variabili: var-device_id       │
               ▼                    │             var-field           │
┌──────────────────────────────┐    └─────────────────────────────────┘
│  DASHBOARD REACT             │                   ▲
│  Porta 5173 (dev) / 8090     │                   │ iframe embed
│                              │───────────────────┘
│  useDittoSSE() → SSE stream  │  (Grafana embedded nella dashboard)
│  ParkMap (Leaflet)           │
│  SensorPanel                 │
│  AdvancedMonitoring          │
└──────────────────────────────┘
```

### Tabella servizi Docker

| Servizio | Container | Porta | Credenziali |
|----------|-----------|-------|-------------|
| Mosquitto (MQTT) | `mosquitto` | 1883, 9001 | — |
| RabbitMQ | `rabbitmq` | 5672, 15672 | `hono` / `hono-secret` |
| MongoDB | `mongodb` | 27017 | `ditto` / `ditto-secret` |
| Ditto Gateway (nginx) | `ditto-nginx` | 8080 | `ditto` / `ditto` |
| Ditto UI | `ditto-ui` | 8081 | `ditto` / `ditto` |
| InfluxDB | `influxdb` | 8086 | `admin` / `admin-secret` |
| Telegraf | `telegraf` | — | — |
| Grafana | `grafana` | 3000 | `admin` / `admin` |
| MQTT Explorer | `mqtt-explorer` | 4000 | — |
| Node-RED | `nodered` | 1880 | — |

---

## Flusso dei Dati — End to End

Il flusso completo da sensore a dashboard si articola in questi passi:

### Passo 1 — Pubblicazione MQTT (Node-RED)

Node-RED genera un payload JSON e lo pubblica su:
```
smartpark/telemetry/<device_id>
```

Struttura payload (esempio ambientale):
```json
{
  "device_id": "env-101",
  "type": "environmental",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "data": {
    "temperature_c": 22.4,
    "humidity_pct": 55.1,
    "pressure_hpa": 1013.2,
    "co2_ppm": 420
  },
  "attributes": {
    "lat": 39.324150,
    "lng": 16.467320
  }
}
```

### Passo 2 — Bridge MQTT → Ditto (Connectivity)

Ditto Connectivity è iscritto al topic `smartpark/telemetry/#`. Per ogni messaggio ricevuto, il **mapper JavaScript** (`mqtt-connection.json`) esegue queste operazioni:

1. Estrae il `device_id` dall'ultimo segmento del topic MQTT
2. Separa `attributes` (metadati statici: tipo, lat, lng) da `data` (telemetria)
3. Costruisce un **Ditto Protocol Message** di tipo `merge` verso `smartpark:<device_id>`
4. La prima volta che arriva un messaggio, Ditto crea il Thing automaticamente (**ImplicitThingCreation**); le volte successive lo aggiorna in modo incrementale

Il Thing Ditto risultante ha questa struttura:
```json
{
  "thingId": "smartpark:env-101",
  "policyId": "smartpark:sensors-policy",
  "attributes": {
    "type": "environmental",
    "device_id": "env-101",
    "lastUpdate": "2026-05-06T10:00:00Z",
    "lat": 39.324150,
    "lng": 16.467320
  },
  "features": {
    "sensors": {
      "properties": {
        "temperature_c": 22.4,
        "humidity_pct": 55.1,
        "pressure_hpa": 1013.2,
        "co2_ppm": 420
      }
    }
  }
}
```

### Passo 3 — Doppio sink parallelo

Il messaggio MQTT viene contemporaneamente:

- **Consumato da Ditto Connectivity** → aggiorna il Digital Twin (stato corrente)
- **Consumato da Telegraf** → scritto in InfluxDB con tag `device_id` e `type` (storico time-series)

I due path sono completamente indipendenti e leggono dallo stesso broker Mosquitto.

### Passo 4 — Lettura dalla Dashboard (SSE + REST)

La dashboard React usa un approccio **ibrido** in due fasi (implementato in `useDittoSSE.js`):

**Fase A — Snapshot iniziale** (HTTP + paginazione cursore):
```
GET /ditto/2/search/things?fields=thingId,features,attributes&option=size(200)
```
Scarica tutti i Things esistenti iterando automaticamente sui cursori Ditto finché non li ha ottenuti tutti. Questo garantisce che la mappa sia popolata immediatamente all'avvio.

**Fase B — Stream SSE** (Server-Sent Events):
```
GET /ditto/2/things?fields=thingId,features,attributes
Accept: text/event-stream
```
Riceve in tempo reale gli eventi `created`, `modified`, `deleted` da Ditto. Per ogni evento aggiorna lo state React corrispondente senza fare polling. In caso di disconnessione, riconnette automaticamente dopo 5 secondi.

---

## Simulazione Sensori (Node-RED)

I flow Node-RED (in `nodered_data/flows.json`) simulano 4 categorie di dispositivi reali, organizzati in tab separati:

### Tab 1 — Sentiment Analysis (20 microfoni, ogni 8s)

Simula 20 microfoni (`mic-300` … `mic-319`) distribuiti casualmente all'interno del perimetro della riserva. Le coordinate GPS sono generate con un algoritmo **point-in-polygon** che garantisce che ogni sensore cada all'interno del perimetro reale (coordinate WGS84 hardcodate). Ogni tick genera:
- `sentiment`: `positive` / `neutral` / `negative` (con probabilità 70% speech detected)
- `sentiment_score`: float in [-1.0, 1.0] coerente col sentiment
- `noise_db`: rumore in dB (55-82 se speech, 28-48 se silenzio)
- `transcript`: frase campione se speech detected

### Tab 2 — Computer Vision (7 telecamere, ogni 6s)

Simula 7 telecamere AI (`cam-200` … `cam-206`) con posizioni fisse nella riserva:
- `person_count`: intero 0-20
- `crowd_density`: `empty` / `low` / `medium` / `high`
- `anomaly_detected`: boolean (10% probabilità)
- `dominant_emotion`: `neutral` / `happy` / `angry` / `sad`

### Tab 3 — Environmental Monitoring (10 sensori, ogni 2s)

Simula 10 stazioni ambientali (`env-100` … `env-109`) con posizioni fisse GPS persistenti tramite `context.set()` di Node-RED:
- `temperature_c`: 15-35 °C
- `humidity_pct`: 30-90%
- `pressure_hpa`: 980-1030 hPa
- `co2_ppm`: 350-1200 ppm

### Tab 4 — Activity Recognition (3 wearable, ogni 1-2s)

Simula 3 visitatori con dispositivi Shimmer BSN (`shimmer-visitor-02`, `04`, `05`) che si spostano lungo percorsi predefiniti all'interno della riserva (array di waypoint GPS). Il movimento è interpolato linearmente tra i waypoint con velocità realistica. Ogni tick:
- Aggiorna `lat`/`lng` → il marker si muove sulla mappa in tempo reale
- Genera `heart_rate_bpm` variabile per attività (`walking` = 90-98, `hiking` = 110-118, `standing` = 70-78)
- Accumula `steps_total`

---

## Mapper JavaScript Ditto

Il mapper (`ditto/connections/mqtt-connection.json`, campo `incomingScript`) traduce un messaggio MQTT generico nel formato Ditto Protocol.

```
MQTT payload (JSON libero)
         │
         ▼  mapToDittoProtocolMsg()
┌─────────────────────────────────────────────────────────┐
│  1. Estrai device_id dall'ultimo segmento topic MQTT    │
│  2. Leggi attributes dal payload (inclusi lat/lng/type) │
│  3. Metti json.data → features.sensors.properties       │
│  4. Costruisci Ditto Protocol MERGE:                    │
│       namespace = "smartpark"                           │
│       entity    = device_id                             │
│       action    = "merge"  (patch incrementale)         │
│       body      = { policyId, attributes, features }    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
  Ditto crea/aggiorna il Thing smartpark:<device_id>
```

Il comando `merge` (Ditto v3+) aggiorna solo i campi presenti nel payload, lasciando invariati gli altri. Questo consente di inviare update parziali senza sovrascrivere dati precedenti.

---

## Persistenza Storica (Telegraf → InfluxDB → Grafana)

### Telegraf (`telegraf/telegraf.conf`)

Telegraf si iscrive a `smartpark/telemetry/#` e usa il parser JSON. La configurazione chiave:

```toml
tag_keys = ["device_id", "type"]   # diventano tag (indicizzati per query efficienti)
json_time_key = "timestamp"         # usa il timestamp del sensore, non l'ora di arrivo
name_override = "sensor_reading"    # measurement name in InfluxDB
```

I campi del blocco `data` del payload diventano fields InfluxDB con prefisso `data_`:
- `data.temperature_c` → field `data_temperature_c`
- `data.humidity_pct` → field `data_humidity_pct`

### InfluxDB

- **Organizzazione**: `smart-park`
- **Bucket**: `sensor-data`
- **Token**: `smart-park-token-12345`
- **Measurement**: `sensor_reading`

### Grafana

Pre-configurato tramite provisioning (`grafana/provisioning/`). Esistono due dashboard:

1. `smart-park.json` — dashboard statica con panel fissi per device_id noti
2. `smart-park-dynamic.json` — dashboard con variabili `var-sensor_id` e `var-field`, usata dal Monitoraggio Avanzato per costruire URL dinamici per ogni selezione

---

## Dashboard React — Architettura Frontend

La dashboard (`dashboard/frontend/`) è costruita con React + Vite + Tailwind CSS. Non ha backend: legge direttamente da Ditto (SSE + REST) e incorpora Grafana via iframe.

### Struttura dei componenti

```
App.jsx
├── StatusBar.jsx              ← barra superiore: metriche aggregate, anomalie, sentiment
├── AdvancedMonitoring.jsx     ← schermata full-screen analisi avanzata
├── SentimentPopup.jsx         ← popup dettaglio sentiment audio
├── SensorList.jsx             ← sidebar sinistra: lista sensori raggruppata per tipo
├── ParkMap.jsx                ← mappa Leaflet con marker live e overlay zone
└── SensorPanel.jsx            ← pannello dettaglio (aperto al click su un sensore)
```

### Hook: `useDittoSSE.js`

È il cuore del frontend. Gestisce tutta la comunicazione con Ditto:

```
useDittoSSE()
  ├── Fase A: DittoQueryBuilder.executeAll()
  │     └── Loop paginato su Search API
  │           GET /ditto/2/search/things?option=size(200)[,cursor(X)]
  │           Itera finché cursor è null o raggiunge 50 pagine (guardia)
  │
  ├── processPayload(thing)
  │     └── Flattening: merge features.*.properties in top-level
  │           { thingId, attributes, features, ...telemetryProps }
  │
  └── Fase B: fetch SSE (Things API)
        GET /ditto/2/things  Accept: text/event-stream
        └── Reader loop su ReadableStream chunked
              event: created/modified → processPayload() → merge() → setState
              event: deleted          → remove() → setState
              disconnessione          → riconnette dopo 5s
```

Il risultato è `sseThings`: un dizionario `{ thingId → Thing }` sempre aggiornato, passato come prop a tutti i componenti.

### Componente: `ParkMap.jsx`

Usa **react-leaflet** per la mappa OpenStreetMap centrata sulla riserva (lat 39.324540, lng 16.467701, zoom 17).

**Marker dinamici**: per ogni sensore in `initialPins`, le coordinate vengono lette dal live data SSE con fallback progressivo:
```js
lat = data?.attributes?.lat ?? data?.lat ?? data?.features?.sensors?.properties?.lat ?? sensor.lat
```
I wearable (che trasmettono lat/lng in `features.sensors.properties`) si spostano sulla mappa in tempo reale ad ogni evento SSE.

**ZoneOverlay**: overlay delle zone del parco in due modalità configurabili in `zoneConfig.js`:
- **POI semantica** (se `ZONES` ha voci): cerchi centrati sulle coordinate configurate
- **Geo-Grid automatica** (default, `ZONES` vuoto): calcola il bounding box di tutti i sensori presenti e lo divide in una griglia 3×2 (NW, N, NE, SW, S, SE)

**Anomalie**: se `anomaly_detected = true`, il marker diventa rosso e compare un anello lampeggiante CSS (`anomaly-ring`).

**Perimetro riserva**: poligono verde semi-trasparente tracciato sulle coordinate reali della riserva.

### Componente: `AdvancedMonitoring.jsx`

Schermata full-screen per l'analisi avanzata con Grafana. Funzionamento:

**Schema derivato dinamicamente** (`thingSchema.js`):
```
sseThings (live)
    │
    ▼  deriveSchema()
schema = {
  "environmental": {
    "Zona NW": {
      "smartpark:env-101": {
        label: "env-101",
        metrics: ["co2_ppm", "humidity_pct", "pressure_hpa", "temperature_c"]
      }
    }
  },
  "vision": { ... }
}
```
L'assegnazione di zona usa `assignZone()`, che in modalità Geo-Grid normalizza le coordinate rispetto al bounding box e calcola la cella di appartenenza.

**Selezione gerarchica** (`ThingTreeFilter`):
Albero a 4 livelli: Tipo → Zona → Sensore → Metrica. Ogni livello ha una checkbox con tre stati (checked / indeterminate / unchecked), calcolati contando le metriche selezionate nei discendenti.

La selezione è un `Set<"thingId::metric">`, es.: `"smartpark:env-101::temperature_c"`.

**Costruzione URL Grafana dinamici**:
```
selezione attiva
    │
    ▼  (raggruppa per metrica unica)
buildGrafanaUrl({
  panelId: 200,
  from: "now-1h",
  deviceIds: ["env-101", "env-103"],  // tutti i sensori con quella metrica selezionata
  fields: ["temperature_c"]
})
    │
    ▼
URL: http://localhost:3000/d-solo/smart-park-dynamic/smart-park-dynamic?
     orgId=1&panelId=200&from=now-1h&to=now&refresh=15s&theme=dark&
     var-sensor_id=env-101&var-sensor_id=env-103&var-field=data_temperature_c
```

**Modalità Raggruppata**: un iframe Grafana per ogni metrica selezionata (tutti i sensori di quella metrica sovrapposti nello stesso grafico).

**Modalità Confronto**: un iframe aggregato con tutti i device e tutte le metriche, più stat panel per ogni singolo device (ultimi valori).

### Componente: `SensorPanel.jsx`

Pannello laterale destro (620px) che si apre al click su un sensore. Mostra:

1. **Badge stato**: Live SSE / Offline + eventuale badge Anomalia
2. **Misure Real-Time** — tutti i fields in `features.sensors.properties` (escluse lat/lng), con icona e unità da `telemetryDictionary`
3. **Informazioni Base** — attributi del thing (esclusi lat/lng/type e campi già nelle misure)
4. **Grafici Storici** — iframe Grafana filtrati per `device_id` e panel scelti per `attributes.type`

### `StatusBar.jsx`

Calcola metriche aggregate da tutti i `sseThings` in tempo reale:
- Temperatura media: `avg(['temperature', 'temperature_c'])`
- Umidità media: `avg(['humidity', 'humidity_pct'])`
- CO₂ media: `avg(['co2_ppm', 'air_quality'])`
- Totale persone rilevate: `sum(['person_count', 'motion', 'activity'])`
- Rumore medio: `avg(['noise', 'noise_db'])`
- Conteggio anomalie: `.filter(d => d.anomaly || d.anomaly_detected).length`
- Sentiment dominante: media dei `sentiment_score` dei sensori audio → positivo/neutro/negativo

### `DittoQueryBuilder.js`

Utility builder per le query Ditto Search API. Caratteristiche:
- Builder fluente: `filterByType()`, `hasAttribute()`, `hasTelemetry()`, `sortBy()`
- Paginazione con cursore: genera `option=size(200),cursor(X)` come singolo parametro (requisito Ditto)
- `executeAll()`: scarica automaticamente tutte le pagine con guardia anti-loop (max 50 pagine)

---

## Struttura del Progetto

```
smart_park_project/
│
├── docker-compose.yml                # Stack completo (15 servizi)
├── setup.sh                          # Setup nginx htpasswd + avvio Docker (Linux)
│
├── ditto/
│   ├── setup.sh                      # Crea policy e connessione MQTT su Ditto (Linux)
│   ├── setup.ps1                     # Idem per Windows PowerShell
│   ├── policies/
│   │   └── smartpark-sensors-policy.json   # Policy accessi Things nel namespace smartpark
│   └── connections/
│       └── mqtt-connection.json      # Configurazione bridge MQTT + mapper JavaScript
│
├── dashboard/
│   └── frontend/
│       ├── vite.config.js            # Proxy /ditto/* → http://localhost:8080/api/2/*
│       └── src/
│           ├── App.jsx               # Root: stato globale, composizione componenti
│           ├── hooks/
│           │   └── useDittoSSE.js    # Hook SSE: snapshot iniziale + stream live mutazioni
│           ├── components/
│           │   ├── StatusBar.jsx         # Barra superiore: metriche aggregate
│           │   ├── ParkMap.jsx           # Mappa Leaflet + zone + marker sensori
│           │   ├── SensorList.jsx        # Sidebar sinistra lista sensori per tipo
│           │   ├── SensorPanel.jsx       # Pannello dettaglio sensore (Grafana + telemetria)
│           │   ├── AdvancedMonitoring.jsx # Schermata analisi avanzata full-screen
│           │   └── SentimentPopup.jsx    # Popup dettaglio analisi sentiment
│           ├── config/
│           │   └── sensorConfig.js       # Dizionario tipi sensore e metriche telemetria
│           └── utils/
│               ├── DittoQueryBuilder.js  # Builder query Search API con paginazione cursore
│               ├── thingSchema.js        # Derivazione schema gerarchico tipo→zona→sensore→metrica
│               └── zoneConfig.js         # Configurazione zone parco (POI semantica o Geo-Grid)
│
├── mosquitto/config/
│   └── mosquitto.conf                # MQTT broker: anonymous access, WebSocket porta 9001
│
├── nginx/
│   ├── nginx.conf                    # Reverse proxy Ditto (porta 8080), basic auth
│   └── nginx.htpasswd                # Credenziali: ditto/ditto, devops/devops
│
├── nodered_data/
│   └── flows.json                    # 4 tab: sentiment, vision, environmental, activity
│
├── telegraf/
│   └── telegraf.conf                 # MQTT consumer → InfluxDB writer
│
└── grafana/provisioning/
    ├── datasources/
    │   └── influxdb.yaml             # Datasource InfluxDB pre-configurata
    └── dashboards/
        ├── smart-park.json           # Dashboard statica (panel fissi per device noti)
        └── smart-park-dynamic.json   # Dashboard con var-sensor_id e var-field
```

---

## Prerequisiti e Avvio

### Prerequisiti

| Strumento | Versione minima |
|-----------|----------------|
| Docker Desktop | 24+ |
| Docker Compose | v2 |
| Node.js | 18+ |
| npm | 9+ |

Su Linux installa anche `apache2-utils` per `htpasswd`:
```bash
sudo apt install -y apache2-utils
```

### 1. Avvia lo stack Docker

**Linux / macOS:**
```bash
chmod +x setup.sh ditto/setup.sh
bash setup.sh
```

Lo script genera `nginx/nginx.htpasswd` e avvia tutti i container con `docker compose up -d`.

**Windows (PowerShell come Amministratore):**
```powershell
$hash = & docker run --rm httpd:alpine htpasswd -nbB ditto ditto
"ditto:$hash" | Out-File -Encoding ascii nginx\nginx.htpasswd
$hash2 = & docker run --rm httpd:alpine htpasswd -nbB devops devops
"devops:$hash2" | Out-File -Encoding ascii -Append nginx\nginx.htpasswd
docker compose up -d
```

> Al primo avvio attendere **2-3 minuti** per l'inizializzazione del cluster Ditto (Pekko/Akka).

### 2. Controlla i container

```bash
docker compose ps
```

Tutti i servizi devono essere `healthy` o `Up`.

### 3. Configura Eclipse Ditto

```bash
bash ditto/setup.sh
```

Lo script:
1. Attende che Ditto risponda (polling max 150s)
2. Crea la policy `smartpark:sensors-policy`
3. Crea la connessione MQTT `smartpark-mqtt-connection`
4. Verifica lo stato della connessione
5. Esegue uno smoke test automatico (se `mosquitto_pub` è installato)

Per resettare tutto:
```bash
bash ditto/setup.sh --reset
```

### 4. Avvia la Dashboard React

```bash
cd dashboard/frontend
npm install
npm run dev
```

La dashboard è disponibile su **http://localhost:5173**

Il Vite dev server fa proxy di `/ditto/*` → `http://localhost:8080/api/*`, quindi non servono credenziali nel browser.

---

## Configurazione Eclipse Ditto

### Policy (`ditto/policies/smartpark-sensors-policy.json`)

Controlla chi può leggere e scrivere i Things nel namespace `smartpark`:
- `nginx:ditto` (usato dal mapper Connectivity) → permesso di scrittura Things
- `ditto:ditto` (dashboard) → permesso di lettura Things e SSE

### Connessione MQTT (`ditto/connections/mqtt-connection.json`)

| Campo | Valore |
|-------|--------|
| `uri` | `tcp://mosquitto:1883` (rete interna Docker) |
| `sources[0].addresses` | `smartpark/telemetry/#` |
| `sources[0].payloadMapping` | `dynamic-json-mapper` (JavaScript) |
| `targets[0].address` | `smartpark/events/{{ thing:id }}` |

Il target pubblica su MQTT gli eventi di modifica dei Twin (utile per debug con MQTT Explorer a :4000).

### Verifica rapida

```bash
# Ditto risponde
curl -u ditto:ditto http://localhost:8080/api/2/things

# Lista Digital Twin creati
curl -u ditto:ditto "http://localhost:8080/api/2/search/things?namespaces=smartpark"

# Stato connessione MQTT
curl -u devops:devops http://localhost:8080/api/2/connections/smartpark-mqtt-connection/status
```

### Test manuale invio sensore

```bash
mosquitto_pub -h localhost -p 1883 \
  -t "smartpark/telemetry/env-test-01" \
  -m '{"type":"environmental","device_id":"env-test-01","timestamp":"2026-01-01T00:00:00Z","data":{"temperature_c":22.0,"humidity_pct":50.0},"attributes":{"lat":39.3245,"lng":16.4677}}'
```

Dopo 2-3 secondi il Twin `smartpark:env-test-01` sarà visibile sulla mappa della dashboard.

---

## Interfacce Web

| Interfaccia | URL | Credenziali |
|-------------|-----|-------------|
| Dashboard Smart Park | http://localhost:5173 | — |
| Ditto REST API | http://localhost:8080/api/2 | `ditto` / `ditto` |
| Ditto Explorer UI | http://localhost:8081 | `ditto` / `ditto` |
| Node-RED | http://localhost:1880 | — |
| RabbitMQ Management | http://localhost:15672 | `hono` / `hono-secret` |
| InfluxDB | http://localhost:8086 | `admin` / `admin-secret` |
| Grafana | http://localhost:3000 | `admin` / `admin` |
| MQTT Explorer | http://localhost:4000 | — |

---

## Stop e Pulizia

```bash
# Ferma i container (dati preservati nei volumi Docker)
docker compose down

# Reset completo: elimina anche tutti i volumi (perde tutti i dati InfluxDB/MongoDB)
docker compose down -v
```

---

## Troubleshooting

### Ditto non risponde su :8080

```bash
docker compose logs ditto-gateway --tail=50
docker compose logs nginx --tail=20
```

Attendi almeno 2 minuti dopo l'avvio. Il cluster Pekko impiega tempo a stabilizzarsi.

### I Digital Twin non vengono creati dai messaggi MQTT

1. Verifica la connessione MQTT:
   ```bash
   curl -u devops:devops http://localhost:8080/api/2/connections/smartpark-mqtt-connection/status
   ```
2. Controlla i log del mapper:
   ```bash
   docker compose logs ditto-connectivity --tail=100
   ```
3. Verifica che Mosquitto riceva i messaggi:
   ```bash
   docker compose logs mosquitto --tail=20
   ```

### Credenziali nginx errate (401)

```bash
htpasswd -cb nginx/nginx.htpasswd ditto ditto
htpasswd -b  nginx/nginx.htpasswd devops devops
docker compose restart nginx
```

### La mappa è vuota (nessun sensore)

Verifica che Node-RED sia attivo e i flow siano in Deploy:
1. Apri http://localhost:1880
2. Clicca **Deploy** (bottone rosso in alto)
3. Attendi 10-15 secondi per i primi messaggi MQTT

### Grafana mostra pannelli vuoti

Verifica che Telegraf stia scrivendo su InfluxDB:
```bash
docker compose logs telegraf --tail=20
```

Se Telegraf è attivo ma i dati non arrivano, verifica che il bucket `sensor-data` esista in InfluxDB (http://localhost:8086).

---

## Note Tecniche

- I Digital Twin si creano **automaticamente** al primo messaggio MQTT di un nuovo `device_id`: non serve configurazione manuale dei Things.
- Il namespace Ditto è `smartpark`. I Thing ID hanno forma `smartpark:<device_id>`.
- La dashboard usa **SSE** per aggiornamenti push senza polling: apre una connessione HTTP persistente con `Accept: text/event-stream`.
- I wearable GPS trasmettono `lat`/`lng` in `features.sensors.properties` (non in `attributes`): il frontend gestisce entrambi i casi con fallback progressivo.
- Ditto **Search API** e **Things API** sono endpoint distinti: solo la Search API supporta filtri RQL e paginazione; solo la Things API supporta SSE.
- Il parametro di paginazione Ditto richiede `option=size(N),cursor(X)` come singolo query param (non `size` e `cursor` separati).
