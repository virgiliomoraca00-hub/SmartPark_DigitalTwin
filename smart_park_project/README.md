# 🌿 Smart Park — Digital Twin IoT Stack

Sistema IoT per il monitoraggio di un parco intelligente basato su **Eclipse Ditto** come motore di Digital Twin, **Mosquitto MQTT**, **Node-RED** come simulatore sensori e un **dashboard React** in tempo reale.

---

## 📐 Architettura

```
Sensori / Node-RED
        │  MQTT (1883)
        ▼
   Mosquitto ──► Ditto Connectivity ──► Ditto Things (Digital Twin)
                                              │
                                    API REST / SSE (8080)
                                              │
                                   Dashboard React (5173)
                                   Ditto UI          (8081)
                                   Grafana           (3000)
```

| Servizio          | Porta  | Credenziali             |
|-------------------|--------|------------------------|
| Ditto API / UI    | 8080   | `ditto` / `ditto`      |
| Ditto Explorer UI | 8081   | `ditto` / `ditto`      |
| Node-RED          | 1880   | —                       |
| RabbitMQ UI       | 15672  | `hono` / `hono-secret` |
| InfluxDB UI       | 8086   | `admin` / `admin-secret` |
| Grafana           | 3000   | `admin` / `admin`      |
| MQTT Explorer     | 4000   | —                       |

---

## ✅ Prerequisiti

| Strumento | Versione minima | Download |
|-----------|----------------|----------|
| Docker Desktop | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2 (incluso in Docker Desktop) | — |
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | incluso in Node.js |

> **Linux**: installa anche `apache2-utils` (per `htpasswd`) o `openssl` (alternativa automatica).
> ```bash
> sudo apt install -y apache2-utils
> ```
> **Windows**: usa il terminale PowerShell come **Amministratore**.

---

## 🚀 Avvio Rapido

### 1. Clona il repository

```bash
git clone https://github.com/<tuo-utente>/smart-park.git
cd smart-park/smart_park_project
```

### 2. Avvia lo stack Docker

#### 🐧 Linux / macOS

```bash
# Rendi eseguibili gli script
chmod +x setup.sh ditto/setup.sh

# Genera credenziali nginx e avvia i container
bash setup.sh
```

Lo script `setup.sh` crea automaticamente:
- Le credenziali nginx (`nginx/nginx.htpasswd`)
- Avvia tutti i container con `docker compose up -d`

#### 🪟 Windows (PowerShell come Amministratore)

```powershell
# Genera credenziali nginx
$hash = & docker run --rm httpd:alpine htpasswd -nbB ditto ditto
"ditto:$hash" | Out-File -Encoding ascii nginx\nginx.htpasswd
$hash2 = & docker run --rm httpd:alpine htpasswd -nbB devops devops
"devops:$hash2" | Out-File -Encoding ascii -Append nginx\nginx.htpasswd

# Avvia lo stack
docker compose up -d
```

> ⏳ Al primo avvio attendere **2-3 minuti** per l'inizializzazione del cluster Ditto.

### 3. Controlla lo stato dei container

```bash
docker compose ps
```

Tutti i servizi devono risultare `healthy` o `Up`.

---

## ⚙️ Configura Eclipse Ditto

Dopo che lo stack è **Up**, esegui lo script di setup Ditto per creare la **policy** e la **connessione MQTT**.

#### 🐧 Linux / macOS

```bash
bash ditto/setup.sh
```

Flag opzionale per resettare policy e connessione esistenti:

```bash
bash ditto/setup.sh --reset
```

#### 🪟 Windows (PowerShell)

```powershell
.\ditto\setup.ps1
```

```powershell
# Con reset:
.\ditto\setup.ps1 -Reset
```

Lo script esegue:
1. **Attende** che Ditto risponda (poll attivo, max 150s)
2. **Crea / aggiorna** la policy `smartpark:sensors-policy`
3. **Crea / aggiorna** la connessione MQTT `smartpark-mqtt-connection`
4. **Verifica** lo stato della connessione
5. **Smoke test** opzionale (se `mosquitto_pub` è installato localmente)

---

## 🌐 Avvia l'interfaccia web (Dashboard React)

```bash
cd dashboard/frontend
npm install
npm run dev
```

La dashboard sarà disponibile su **http://localhost:5173**

> La prima volta `npm install` scarica le dipendenze (~60 secondi).

---

## 🔴 Simulazione Sensori con Node-RED

Node-RED è già incluso nello stack Docker e carica automaticamente i flow salvati in `nodered_data/flows.json`.

1. Apri **http://localhost:1880**
2. I flow di simulazione sono già importati. Fai clic su **Deploy** (bottone rosso in alto a destra) se non è già attivo.
3. I sensori simulati pubblicano sul topic MQTT:
   ```
   smartpark/telemetry/<device_id>
   ```
   con payload:
   ```json
   {
     "type": "environmental",
     "device_id": "env-100",
     "timestamp": "2026-04-15T10:00:00Z",
     "lat": 39.3245,
     "lng": 16.4677,
     "data": {
       "temperature_c": 22.4,
       "humidity_pct": 55.1
     }
   }
   ```

### Pubblicazione manuale (test rapido)

```bash
# Linux / macOS (richiede mosquitto-clients)
mosquitto_pub -h localhost -p 1883 \
  -t "smartpark/telemetry/env-test-01" \
  -m '{"type":"environmental","device_id":"env-test-01","timestamp":"2026-04-15T10:00:00Z","lat":39.3245,"lng":16.4677,"data":{"temperature_c":22.0,"humidity_pct":50.0}}'
```

```powershell
# Windows PowerShell
$payload = '{"type":"environmental","device_id":"env-test-01","timestamp":"2026-04-15T10:00:00Z","lat":39.3245,"lng":16.4677,"data":{"temperature_c":22.0,"humidity_pct":50.0}}'
mosquitto_pub -h localhost -p 1883 -t "smartpark/telemetry/env-test-01" -m $payload
```

Dopo pochi secondi il Digital Twin `smartpark:env-test-01` sarà visibile su Ditto:

```bash
curl -u ditto:ditto http://localhost:8080/api/2/things/smartpark:env-test-01
```

---

## 🖥️ Interfacce Web disponibili

| Interfaccia | URL | Credenziali |
|-------------|-----|-------------|
| **Dashboard Smart Park** | http://localhost:5173 | — |
| **Ditto REST API** | http://localhost:8080/api/2 | `ditto` / `ditto` |
| **Ditto Explorer UI** | http://localhost:8081 | `ditto` / `ditto` |
| **Node-RED** | http://localhost:1880 | — |
| **RabbitMQ Management** | http://localhost:15672 | `hono` / `hono-secret` |
| **InfluxDB** | http://localhost:8086 | `admin` / `admin-secret` |
| **Grafana** | http://localhost:3000 | `admin` / `admin` |
| **MQTT Explorer** | http://localhost:4000 | — |

---

## 🧪 Verifica rapida dello stack

```bash
# 1. Controlla che Ditto risponda
curl -u ditto:ditto http://localhost:8080/api/2/things

# 2. Lista i Digital Twin creati
curl -u ditto:ditto "http://localhost:8080/api/2/search/things?namespaces=smartpark"

# 3. Controlla la connessione MQTT
curl -u devops:devops http://localhost:8080/api/2/connections/smartpark-mqtt-connection/status
```

---

## 🛑 Stop e pulizia

```bash
# Ferma i container (i dati sono preservati nei volumi Docker)
docker compose down

# Ferma e rimuovi TUTTI i dati (reset completo)
docker compose down -v
```

---

## 📁 Struttura del progetto

```
smart_park_project/
├── docker-compose.yml          # Stack completo
├── setup.sh                    # Setup stack Linux/macOS
├── ditto/
│   ├── setup.sh                # Config Ditto (Linux/macOS)
│   ├── setup.ps1               # Config Ditto (Windows)
│   ├── policies/
│   │   └── smart-park-policy.json
│   └── connections/
│       └── mqtt-connection.json
├── dashboard/
│   ├── frontend/               # React + Vite (npm run dev)
│   └── backend/                # FastAPI (Python)
├── mosquitto/config/           # Configurazione MQTT broker
├── nodered_data/               # Flow Node-RED (simulatore)
├── mappers/commonjs/           # JS mapper per Ditto Connectivity
├── grafana/provisioning/       # Dashboard Grafana pre-configurate
├── nginx/                      # Reverse proxy config + htpasswd
└── telegraf/                   # Bridge MQTT → InfluxDB
```

---

## 🐛 Troubleshooting

### Ditto non risponde su :8080
```bash
docker compose logs ditto-gateway --tail=50
docker compose logs nginx --tail=20
```
Attendi almeno 2 minuti dopo l'avvio prima che il cluster Pekko/Akka si stabilizzi.

### Credenziali nginx errate (401)
```bash
# Rigenera il file htpasswd
htpasswd -cb nginx/nginx.htpasswd ditto ditto
htpasswd -b  nginx/nginx.htpasswd devops devops
docker compose restart nginx
```

### I Digital Twin non vengono creati dai messaggi MQTT
1. Verifica che la connessione sia attiva:
   ```bash
   curl -u devops:devops http://localhost:8080/api/2/connections/smartpark-mqtt-connection/status
   ```
2. Controlla i log di Ditto Connectivity:
   ```bash
   docker compose logs ditto-connectivity --tail=100
   ```
3. Verifica che Mosquitto riceva i messaggi:
   ```bash
   docker compose logs mosquitto --tail=20
   ```

### Node-RED — flow non visibili
Il volume `./nodered_data` contiene i flow. Se apri Node-RED e la canvas è vuota, fai clic su ☰ → **Import** e carica manualmente `nodered_data/flows.json`.

---

## 📝 Note per i colleghi

- I messaggi MQTT vengono trasformati in Digital Twin automaticamente tramite **ImplicitThingCreation** di Ditto — non serve configurare modelli JSON.
- Il namespace Ditto è `smartpark`. I Thing ID hanno forma `smartpark:<device_id>`.
- La dashboard React usa **SSE** (Server-Sent Events) per aggiornamenti in tempo reale senza polling.
- Il mapper JS è in `ditto/connections/mqtt-connection.json` nel campo `mappingDefinitions`.
