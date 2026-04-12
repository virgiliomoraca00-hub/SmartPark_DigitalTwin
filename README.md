# Smart Park — Digital Twin Platform

Piattaforma IoT per il monitoraggio in tempo reale del **Parco Nazionale della Sila**. Il progetto implementa un'architettura completa di **Digital Twin**: sensori virtuali pubblicano dati ambientali su un bus MQTT, da cui l'infrastruttura li instrada automaticamente verso un motore di Digital Twin (Eclipse Ditto), un database time-series (InfluxDB) e una web app di monitoraggio interattiva.

---

## Indice

1. [Architettura generale](#architettura-generale)
2. [Flusso dei dati](#flusso-dei-dati)
3. [Componenti](#componenti)
   - [Sensor Simulator](#sensor-simulator)
   - [Eclipse Mosquitto — MQTT Broker](#eclipse-mosquitto--mqtt-broker)
   - [Telegraf — Bridge MQTT → InfluxDB](#telegraf--bridge-mqtt--influxdb)
   - [InfluxDB — Time-Series Database](#influxdb--time-series-database)
   - [Eclipse Ditto — Digital Twin Engine](#eclipse-ditto--digital-twin-engine)
   - [Grafana — Dashboard Tecnica](#grafana--dashboard-tecnica)
   - [Dashboard Web App](#dashboard-web-app)
   - [MongoDB — Persistenza Ditto](#mongodb--persistenza-ditto)
   - [RabbitMQ — Comunicazione interna Ditto](#rabbitmq--comunicazione-interna-ditto)
   - [Nginx — Reverse Proxy](#nginx--reverse-proxy)
   - [MQTT Explorer — Debug UI](#mqtt-explorer--debug-ui)
4. [Avvio del progetto](#avvio-del-progetto)
5. [Credenziali](#credenziali)
6. [Struttura del progetto](#struttura-del-progetto)

---

## Architettura generale

Il progetto è composto da due layer distinti:

**Layer infrastrutturale (Docker)**
Gestisce la raccolta, il routing, la persistenza e l'esposizione dei dati dei sensori. Tutti i servizi girano come container Docker e comunicano tra loro tramite una rete interna (`iot-net`).

**Layer applicativo**
La web app di monitoraggio che consuma i dati esposti dall'infrastruttura e li presenta agli utenti finali in modo interattivo.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAYER APPLICATIVO                            │
│                                                                     │
│   Dashboard Web App (React + Vite)           Grafana                │
│   ├── Mappa interattiva del parco            Dashboard tecnica       │
│   ├── Marker sensori in tempo reale          con serie storiche      │
│   ├── Pannello dettaglio per sensore         (embedded via iframe)   │
│   └── Feed analisi sentiment                                         │
└───────────────┬─────────────────────┬───────────────────────────────┘
                │ MQTT WebSocket       │ HTTP (InfluxDB + Ditto)
                │ ws://localhost:9001  │ tramite FastAPI
┌───────────────▼─────────────────────▼───────────────────────────────┐
│                     LAYER INFRASTRUTTURALE                          │
│                                                                     │
│   Mosquitto ──► Telegraf ──► InfluxDB ──► Grafana                  │
│       │                                                             │
│       └──────► Eclipse Ditto ──► MongoDB                           │
└─────────────────────────────────────────────────────────────────────┘
                ▲
        sensor_simulator.py
```

---

## Flusso dei dati

### Flusso principale (sensori → storage)

```
sensor_simulator.py
        │
        │  pubblica JSON ogni 5s
        │  topic: smart-park/{sensor_id}/telemetry
        ▼
Eclipse Mosquitto (MQTT Broker :1883)
        │
   ┌────┴──────────────────────────────┐
   │                                   │
   ▼                                   ▼
Telegraf                         Eclipse Ditto
(sottoscritto a MQTT)            (sottoscritto a MQTT)
   │                                   │
   │ scrive ogni lettura               │ aggiorna lo stato
   │ come punto time-series            │ corrente del Twin
   ▼                                   ▼
InfluxDB                           MongoDB
(serie storica completa)           (snapshot stato attuale)
   │
   ▼
Grafana (query ogni 5s)
```

**Punto chiave:** il simulatore scrive **esclusivamente su MQTT**. Non sa nulla di InfluxDB, Ditto o Grafana. È l'infrastruttura a occuparsi del routing e della persistenza dei dati.

---

### Flusso real-time verso la web app

```
Eclipse Mosquitto
        │
        │  WebSocket (porta 9001)
        │  accessibile direttamente dal browser
        ▼
Dashboard Web App (React)
        │
        │  hook useMqtt.js
        │  aggiorna lo stato React ad ogni messaggio
        ▼
Mappa interattiva (marker colorati in tempo reale)
```

Il browser si connette **direttamente** al broker MQTT via WebSocket — senza passare per il backend FastAPI — ottenendo aggiornamenti in tempo reale con latenza minima (< 1 secondo).

---

### Flusso dati storici (grafici)

```
Dashboard Web App
        │
        │  click su un sensore
        ▼
FastAPI (backend :8000)
        │
        │  GET /history/{sensor_id}
        │  query Flux su InfluxDB
        ▼
InfluxDB
        │
        ▼
Grafana panel (embedded via iframe)
        │
        ▼
SensorPanel — grafici ultimi 30 minuti
```

---

### Flusso analisi sentiment

```
Gruppo Computer Vision / NLP
        │
        │  POST /sentiment
        │  { zone, sentiment, score, action, description }
        ▼
FastAPI (backend :8000)
        │
        │  scrive su InfluxDB
        │  measurement: sentiment_data
        ▼
InfluxDB
        │
        ▼
Dashboard Web App
        │  polling ogni 10s → GET /sentiment/latest
        ▼
SentimentPanel (3 zone: Nord, Centro, Sud)
```

---

## Componenti

### Sensor Simulator

**File:** `scripts/sensor_simulator.py`

Script Python che simula **10 sensori ambientali** distribuiti nel parco. Ogni 5 secondi genera dati realistici con variazioni sinusoidali (per simulare cicli giornalieri) più rumore casuale, e li pubblica su MQTT. Ogni sensore ha un **phase offset** diverso in modo che i valori non siano identici tra loro.

**Sensori simulati:**

| ID | Nome | Zona |
|----|------|------|
| `sensor-entrance` | Ingresso Principale | Sud |
| `sensor-lake` | Area Lago | Centro |
| `sensor-playground` | Area Giochi | Centro |
| `sensor-north-1` | Sentiero Nord | Nord |
| `sensor-north-2` | Bosco Nord-Est | Nord |
| `sensor-west` | Area Ovest | Centro |
| `sensor-east` | Area Est | Centro |
| `sensor-south-1` | Picnic Sud | Sud |
| `sensor-south-2` | Parcheggio Sud | Sud |
| `sensor-center` | Centro Parco | Centro |

**Misure generate da ogni sensore:**

| Campo | Range | Unità | Metodo simulazione |
|-------|-------|-------|--------------------|
| `temperature` | 15 – 28 | °C | Sinusoide + rumore |
| `humidity` | 40 – 80 | % | Sinusoide inversa + rumore |
| `air_quality` | 400 – 900 | ppm CO₂ | Sinusoide con offset + rumore |
| `motion` | 0 – 50 | persone rilevate | Sinusoide + random |
| `noise` | 30 – 80 | dB | Sinusoide + rumore |
| `anomaly` | true/false | — | 2% probabilità (spike CO₂ × 1.8) |

**Topic MQTT pubblicati:**
```
smart-park/{sensor_id}/telemetry
```

**Payload esempio:**
```json
{
  "sensor_id":   "sensor-entrance",
  "timestamp":   "2026-04-08T10:00:00+00:00",
  "temperature": 21.5,
  "humidity":    58.4,
  "air_quality": 720.3,
  "motion":      12,
  "noise":       55.1,
  "anomaly":     false
}
```

**Avvio:**
```bash
source smart_park_env/bin/activate
python3 scripts/sensor_simulator.py
```

---

### Eclipse Mosquitto — MQTT Broker

**Porta:** 1883 (MQTT) | 9001 (WebSocket)
**Configurazione:** `mosquitto/config/mosquitto.conf`

Il broker MQTT è il **punto centrale di ingresso dati** dell'intera infrastruttura. Implementa il pattern publish/subscribe: i produttori di dati (simulatori, sensori reali) pubblicano messaggi su topic, mentre i consumatori (Telegraf, Ditto, browser) si sottoscrivono ai topic di interesse.

Mosquitto non conosce la struttura dei dati — trasporta semplicemente i messaggi dal produttore ai consumatori registrati. Questo disaccoppiamento è il punto di forza dell'architettura: aggiungere un nuovo consumatore non richiede modifiche al simulatore.

**Configurazione rilevante:**
- Listener MQTT su porta 1883 (protocollo nativo, usato da Telegraf e Ditto)
- Listener WebSocket su porta 9001 (usato dal browser per gli aggiornamenti real-time)
- Connessioni anonime permesse (modalità sviluppo)
- Persistenza messaggi attiva su `/mosquitto/data/`

---

### Telegraf — Bridge MQTT → InfluxDB

**Configurazione:** `telegraf/telegraf.conf`

Telegraf è un agente di raccolta dati. Si sottoscrive ai topic MQTT `smart-park/+/telemetry`, parsa ogni payload JSON e lo scrive in InfluxDB come punto temporale. È il componente che costruisce la **serie storica** che alimenta i grafici.

**Pipeline interna:**
```
MQTT Consumer plugin
    │  riceve messaggi da smart-park/+/telemetry (QoS 1)
    │  parsa il JSON
    │  estrae sensor_id come tag (indicizzato per query veloci)
    │  legge il timestamp dal payload
    ▼
InfluxDB Output plugin
    │  scrive measurement: sensor_reading
    │  bucket: sensor-data
    │  ogni 5 secondi (flush interval)
    ▼
InfluxDB
```

---

### InfluxDB — Time-Series Database

**Porta:** 8086 | **UI:** http://localhost:8086

Database ottimizzato per serie temporali. Conserva l'intera storia delle misurazioni di tutti i sensori. Usa il linguaggio di query **Flux**.

| Parametro | Valore |
|-----------|--------|
| Organization | `smart-park` |
| Bucket | `sensor-data` |
| Admin token | `smart-park-token-12345` |
| Measurement sensori | `sensor_reading` |
| Measurement sentiment | `sentiment_data` |
| Tag sensori | `sensor_id` |
| Tag sentiment | `zone` |

**Esempio query Flux — storico temperatura sensore:**
```flux
from(bucket: "sensor-data")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "sensor_reading"
       and r._field == "temperature"
       and r.sensor_id == "sensor-entrance")
  |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
```

**Esempio query Flux — ultimo sentiment per zona:**
```flux
from(bucket: "sensor-data")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sentiment_data")
  |> last()
  |> pivot(rowKey: ["_time", "zone"], columnKey: ["_field"], valueColumn: "_value")
```

---

### Eclipse Ditto — Digital Twin Engine

**Porta:** 8080 (tramite Nginx) | **Credenziali:** `ditto` / `ditto`

Mantiene una **rappresentazione virtuale aggiornata** di ogni sensore fisico (il "Digital Twin"). A differenza di InfluxDB che conserva la serie storica, Ditto mantiene solo lo **stato corrente** di ogni sensore ed è la fonte di verità per la configurazione e il censimento dei sensori.

È composto da 5 microservizi che formano un cluster distribuito (Pekko cluster):

| Microservizio | Ruolo |
|---------------|-------|
| `ditto-policies` | Gestisce le policy di accesso: chi può leggere/scrivere cosa sui Twin |
| `ditto-things` | Gestisce il ciclo di vita dei Digital Twin (creazione, aggiornamento, cancellazione) |
| `ditto-things-search` | Motore di ricerca e filtraggio sui Twin |
| `ditto-connectivity` | Si connette a MQTT, riceve i messaggi e aggiorna le features dei Twin |
| `ditto-gateway` | Espone le API REST e WebSocket verso l'esterno |

#### Come Ditto riceve i dati dai sensori

Il servizio `ditto-connectivity` è configurato per:
1. Connettersi a Mosquitto via TCP
2. Sottoscriversi al topic `smart-park/+/telemetry`
3. Eseguire uno **script JavaScript di mapping** su ogni messaggio ricevuto
4. Aggiornare le features del Digital Twin corrispondente tramite Ditto Protocol

Lo script di mapping si trova in `ditto/connections/mqtt-connection.json` e si occupa anche della classificazione della qualità dell'aria:
- `> 800 ppm CO₂` → status `poor`
- `600–800 ppm CO₂` → status `moderate`
- `< 600 ppm CO₂` → status `good`

#### Struttura di un Digital Twin

```json
{
  "thingId": "smart-park:sensor-entrance",
  "policyId": "smart-park:policy",
  "attributes": {
    "name": "Ingresso Principale",
    "location": { "lat": 38.1157, "lon": 13.3615 },
    "type": "environmental-sensor"
  },
  "features": {
    "temperature": { "properties": { "value": 21.5,  "unit": "°C" } },
    "humidity":    { "properties": { "value": 58.4,  "unit": "%" } },
    "airQuality":  { "properties": { "co2_ppm": 720.3, "status": "moderate" } },
    "motion":      { "properties": { "people_count": 12 } },
    "noise":       { "properties": { "value": 55.1,  "unit": "dB" } },
    "status":      { "properties": { "last_update": "...", "anomaly": false } }
  }
}
```

#### API REST

Base URL: `http://localhost:8080/api/2` | Auth: Basic `ditto:ditto`

```bash
# Lista tutti i Digital Twin
GET /things

# Leggi lo stato completo di un Twin
GET /things/smart-park:sensor-entrance

# Leggi solo una feature
GET /things/smart-park:sensor-entrance/features/temperature

# Cerca Twin per tipo
GET /search/things?filter=eq(attributes/type,"environmental-sensor")
```

---

### Grafana — Dashboard Tecnica

**Porta:** 3000 | **URL:** http://localhost:3000 | **Credenziali:** `admin` / `admin`

Dashboard tecnica che legge i dati da InfluxDB e li visualizza in tempo reale. La dashboard e il datasource vengono caricati automaticamente all'avvio tramite il sistema di **provisioning** (cartella `grafana/provisioning/`) — nessuna configurazione manuale necessaria.

Nel contesto del progetto Grafana ha due ruoli:
1. **Strumento tecnico standalone** — per operatori e sviluppatori che vogliono analisi avanzate, query personalizzate e configurazione degli alert
2. **Fonte dei grafici per la web app** — i pannelli Grafana vengono embeddati tramite iframe nella SensorPanel della web app

**Pannelli disponibili (dashboard "Smart Park - Digital Twin"):**

*Stato attuale — ultimi 5 minuti (stat panels):*
- Temperatura Media | Umidità Media | CO₂ Media | Persone nel Parco | Rumore Medio | Contatore Anomalie

*Serie temporali per zona (time series):*
- Temperatura per Zona (panel 10) | Umidità per Zona (11) | CO₂ per Zona (12)
- Persone per Zona (13) | Rumore per Zona (14) | Tabella Anomalie (15)

*Serie temporali per singolo sensore — filtrate via variabile `sensor_id`:*
- Temperatura Sensore (panel 20) | Umidità Sensore (21) | CO₂ Sensore (22)
- Persone Sensore (23) | Rumore Sensore (24)

**Soglie di allerta visiva:**

| Metrica | Verde | Giallo | Rosso |
|---------|-------|--------|-------|
| Temperatura | < 25°C | 25–35°C | > 35°C |
| Umidità | 30–75% | > 75% | < 30% |
| CO₂ | < 600 ppm | 600–800 ppm | > 800 ppm |
| Persone | < 20 | 20–40 | > 40 |
| Rumore | < 60 dB | 60–75 dB | > 75 dB |
| Anomalie | 0 | — | ≥ 1 |

---

### Dashboard Web App

**URL:** http://localhost:5173 (sviluppo)
**Stack:** React + Vite, Tailwind CSS, MQTT.js, FastAPI

La web app è l'interfaccia principale di monitoraggio del parco. È composta da:

#### Frontend (React)

**`App.jsx`**
Componente radice. Gestisce lo stato globale: connessione MQTT, sensore selezionato, layout generale.

**`StatusBar.jsx`**
Barra in cima alla pagina. Mostra le metriche globali mediate su tutti i sensori (temperatura, umidità, CO₂, persone totali, rumore) e il badge di anomalie attive. Si aggiorna ad ogni messaggio MQTT.

**`ParkMap.jsx`**
Mappa interattiva del parco. Carica l'SVG del Parco Nazionale della Sila e sovrappone un SVG overlay con i marker dei sensori. I marker sono posizionati con coordinate nel sistema di riferimento del viewBox SVG (`0 0 297 297`) — così restano fissi rispetto alla mappa indipendentemente dalla dimensione del contenitore. Colori: verde = normale, giallo = attenzione, rosso = anomalia. Click su un marker → apre SensorPanel.

**`SensorPanel.jsx`**
Pannello laterale che si apre al click su un sensore. Mostra:
- Valori correnti del sensore (da MQTT)
- Toggle tra vista "questo sensore" e "zona"
- Grafici Grafana embeddati via iframe per la serie storica

**`SentimentPanel.jsx`**
Pannello in fondo alla pagina. Mostra il sentiment rilevato per le tre zone del parco (Nord, Centro, Sud). Si aggiorna ogni 10 secondi interrogando il backend FastAPI.

**`hooks/useMqtt.js`**
Custom hook React. Gestisce la connessione al broker MQTT via WebSocket (porta 9001), la sottoscrizione ai topic `smart-park/+/telemetry` e l'aggiornamento dello stato React ad ogni messaggio ricevuto.

**`data/sensors.js`**
Configurazione statica dei 10 sensori virtuali: ID, nome, zona, coordinate sulla mappa (x%, y% nel sistema viewBox).

#### Backend (FastAPI)

**File:** `dashboard/backend/main.py`
**Porta:** 8000

Espone 4 endpoint:

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/history/{sensor_id}` | GET | Storico ultimi 30 min per sensore e metrica (da InfluxDB) |
| `/sentiment` | POST | Riceve evento sentiment da sistemi esterni (CV/NLP) |
| `/sentiment/latest` | GET | Ultimo sentiment per ogni zona (da InfluxDB) |

#### Simulatore sentiment

**File:** `dashboard/backend/sentiment_simulator.py`

Script Python che simula l'invio di eventi sentiment ogni 10 secondi per le 3 zone del parco. Utile per testare il pannello sentiment senza il gruppo di Computer Vision.

```bash
source smart_park_env/bin/activate
python3 dashboard/backend/sentiment_simulator.py
```

**Formato evento sentiment (POST /sentiment):**
```json
{
  "zone": "nord",
  "sentiment": "positive",
  "score": 0.85,
  "action": "Persone che passeggiano",
  "description": "Atmosfera rilassata, visitatori soddisfatti"
}
```

---

### MongoDB — Persistenza Ditto

**Porta:** 27017 | **Credenziali:** `ditto` / `ditto-secret`

Usato esclusivamente da Eclipse Ditto per persistere lo stato dei Digital Twin tra i riavvii dei container. Non viene acceduto direttamente dall'applicazione.

---

### RabbitMQ — Comunicazione interna Ditto

**Porta:** 5672 (AMQP) | 15672 (Management UI: http://localhost:15672)
**Credenziali Management UI:** `hono` / `hono-secret`

Bus di messaggi interno ai 5 microservizi di Eclipse Ditto. Il servizio Connectivity lo usa per comunicare con gli altri microservizi del cluster. Non viene utilizzato direttamente dal codice applicativo.

---

### Nginx — Reverse Proxy

**Porta:** 8080 (esposta all'host)

Si trova davanti a `ditto-gateway` e ha due ruoli:
1. **Basic Auth** — verifica le credenziali tramite `nginx/nginx.htpasswd`
2. **Pre-autenticazione Ditto** — passa l'utente autenticato tramite l'header `x-ditto-pre-authenticated`, evitando una doppia autenticazione interna a Ditto

Supporta anche l'upgrade a WebSocket (necessario per le Ditto Live Messages).

---

### MQTT Explorer — Debug UI

**Porta:** 4000 | **URL:** http://localhost:4000

Interfaccia web per ispezionare in tempo reale i messaggi che transitano su Mosquitto. Utile per verificare che il simulatore stia pubblicando correttamente e per analizzare i payload MQTT senza scrivere codice.

Per connettersi dall'interno della UI: Host `mosquitto`, Port `1883`.

---

## Avvio del progetto

### Prerequisiti

- Docker Engine >= 28.x con Docker Compose plugin v2
- Python 3.12 con virtualenv (`smart_park_env/` già presente)
- Node.js >= 20.x
- Utente nel gruppo `docker` (`sudo usermod -aG docker $USER` + logout/login)

### Ordine di avvio

**Terminale 1 — Infrastruttura Docker**
```bash
cd ~/Desktop/smart_park_project
docker compose up -d
```
Attendi 60-120 secondi per la completa inizializzazione di Eclipse Ditto.

**Terminale 2 — Simulatore sensori**
```bash
cd ~/Desktop/smart_park_project
source smart_park_env/bin/activate
python3 scripts/sensor_simulator.py
```

**Terminale 3 — Backend FastAPI**
```bash
cd ~/Desktop/smart_park_project
source smart_park_env/bin/activate
uvicorn dashboard.backend.main:app --reload --port 8000
```

**Terminale 4 — Frontend React**
```bash
cd ~/Desktop/smart_park_project/dashboard/frontend
npm run dev
```

**Terminale 5 — Simulatore sentiment (opzionale)**
```bash
cd ~/Desktop/smart_park_project
source smart_park_env/bin/activate
python3 dashboard/backend/sentiment_simulator.py
```

### Verifica dello stack

```bash
source smart_park_env/bin/activate
python3 scripts/test_stack.py
```

Tutti i test devono dare `PASS`.

### Arresto

```bash
docker compose down
```

I dati nei volumi Docker (InfluxDB, MongoDB, Grafana) vengono preservati tra i riavvii.

---

## Credenziali

| Servizio | URL | Username | Password |
|----------|-----|----------|----------|
| Web App Dashboard | http://localhost:5173 | — | — |
| FastAPI Backend | http://localhost:8000 | — | — |
| Grafana | http://localhost:3000 | `admin` | `admin` |
| Eclipse Ditto API | http://localhost:8080/api/2 | `ditto` | `ditto` |
| Eclipse Ditto DevOps | http://localhost:8080/devops | `devops` | `devops` |
| InfluxDB UI | http://localhost:8086 | `admin` | `admin-secret` |
| RabbitMQ Management | http://localhost:15672 | `hono` | `hono-secret` |
| MQTT Explorer | http://localhost:4000 | — | — |
| MongoDB | localhost:27017 | `ditto` | `ditto-secret` |

---

## Struttura del progetto

```
smart_park_project/
│
├── docker-compose.yml                  # Orchestrazione stack (13 servizi Docker)
├── setup.sh                            # Script inizializzazione (primo avvio)
│
├── mosquitto/
│   └── config/
│       └── mosquitto.conf              # Broker MQTT (porte 1883 e 9001 WebSocket)
│
├── nginx/
│   ├── nginx.conf                      # Reverse proxy + Basic Auth verso Ditto
│   └── nginx.htpasswd                  # Credenziali utenti Ditto (hash APR1)
│
├── telegraf/
│   └── telegraf.conf                   # Bridge MQTT → InfluxDB
│
├── grafana/
│   └── provisioning/
│       ├── datasources/
│       │   └── influxdb.yaml           # Connessione InfluxDB (auto-provisioning)
│       └── dashboards/
│           ├── dashboard.yaml          # Provider dashboard
│           └── smart-park.json         # Dashboard con pannelli per zona e per sensore
│
├── ditto/
│   ├── setup.sh                        # Crea policy, things e connection via API REST
│   ├── policies/
│   │   └── smart-park-policy.json      # Policy di accesso ai Digital Twin
│   ├── things/
│   │   ├── sensor-entrance.json        # Digital Twin — Ingresso Principale
│   │   ├── sensor-lake.json            # Digital Twin — Area Lago
│   │   └── sensor-playground.json      # Digital Twin — Area Giochi
│   └── connections/
│       └── mqtt-connection.json        # Connessione Ditto↔Mosquitto + mapping JS
│
├── scripts/
│   ├── sensor_simulator.py             # Simulatore 10 sensori (pubblica su MQTT)
│   ├── test_stack.py                   # Test suite completa
│   └── requirements.txt               # Dipendenze Python infrastruttura
│
├── dashboard/
│   ├── backend/
│   │   ├── main.py                     # FastAPI: storico sensori + endpoint sentiment
│   │   ├── sentiment_simulator.py      # Simulatore eventi sentiment (3 zone)
│   │   └── requirements.txt           # Dipendenze Python backend
│   │
│   └── frontend/
│       ├── public/
│       │   └── mappa_parco_sila.svg    # Mappa SVG del parco (sfondo interattivo)
│       ├── src/
│       │   ├── App.jsx                 # Componente radice + layout
│       │   ├── components/
│       │   │   ├── ParkMap.jsx         # Mappa SVG + overlay marker sensori
│       │   │   ├── SensorPanel.jsx     # Pannello dettaglio sensore + iframe Grafana
│       │   │   ├── SentimentPanel.jsx  # Feed sentiment 3 zone
│       │   │   └── StatusBar.jsx       # Barra metriche globali
│       │   ├── hooks/
│       │   │   └── useMqtt.js          # Hook connessione MQTT WebSocket
│       │   └── data/
│       │       └── sensors.js          # Configurazione 10 sensori virtuali
│       ├── package.json
│       └── vite.config.js              # Proxy /api → FastAPI :8000
│
└── smart_park_env/                     # Virtualenv Python (non committare)
```
