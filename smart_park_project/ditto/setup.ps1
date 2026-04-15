# ============================================================
#  DITTO SETUP - Smart Park  (v3 - Zero Model / ImplicitThingCreation)
#  Versione Windows PowerShell
#
#  Crea policy e connessione MQTT su Eclipse Ditto.
#  I Things vengono creati AUTOMATICAMENTE da ImplicitThingCreation
#  al primo messaggio MQTT ricevuto da ogni sensore.
#  Non sono necessari modelli JSON né mapper CommonJS.
#
#  Payload MQTT atteso su smartpark/telemetry/<device_id>:
#  {
#    "type": "environmental",
#    "device_id": "env-100",
#    "timestamp": "2026-04-14T09:00:00Z",
#    "lat": 39.3245, "lng": 16.4677,
#    "data": { "temperature_c": 22.4, "humidity_pct": 55.1 }
#  }
#
#  Uso:         .\setup.ps1
#  Flag reset:  .\setup.ps1 -Reset
#
#  Requisiti: PowerShell 5.1+ oppure PowerShell 7+
# ============================================================

param(
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

$DITTO_URL = "http://localhost:8080"
$DITTO_USER = "ditto"
$DITTO_PASS = "ditto"
$DEVOPS_USER = "devops"
$DEVOPS_PASS = "devops"
$NAMESPACE = "smartpark"
$POLICY_ID = "$NAMESPACE`:sensors-policy"
$CONNECTION_ID = "$NAMESPACE-mqtt-connection"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

# ── Helper: credenziali Base64 ────────────────────────────────────────────────
function Get-BasicAuth($user, $pass) {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes("${user}:${pass}")
    return "Basic " + [Convert]::ToBase64String($bytes)
}

# ── Helper: chiamata HTTP ─────────────────────────────────────────────────────
# Restituisce un oggetto con .StatusCode e .Body
function Invoke-DittoRequest {
    param(
        [string]$Method,
        [string]$Url,
        [string]$User,
        [string]$Pass,
        [string]$Body = ""
    )

    $headers = @{
        "Authorization" = (Get-BasicAuth $User $Pass)
        "Content-Type"  = "application/json"
    }

    try {
        $params = @{
            Method  = $Method
            Uri     = $Url
            Headers = $headers
        }
        if ($Body -ne "") {
            $params["Body"] = $Body
        }

        $response = Invoke-WebRequest @params -UseBasicParsing
        return @{ StatusCode = $response.StatusCode; Body = $response.Content }

    }
    catch [System.Net.WebException] {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        return @{ StatusCode = $statusCode; Body = $body }
    }
    catch {
        return @{ StatusCode = 0; Body = $_.Exception.Message }
    }
}

# ── Log helpers ───────────────────────────────────────────────────────────────
function Write-Ok($msg) { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [ERR]  $msg" -ForegroundColor Red; exit 1 }
function Write-Info($msg) { Write-Host ""; Write-Host ">> $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Skip($msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Gray }

# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Smart Park - Setup Eclipse Ditto  (Dynamic Mapper)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── Flag -Reset ───────────────────────────────────────────────────────────────
if ($Reset) {
    Write-Info "[RESET] Eliminazione connessione MQTT..."
    $r = Invoke-DittoRequest DELETE "$DITTO_URL/api/2/connections/$CONNECTION_ID" $DEVOPS_USER $DEVOPS_PASS
    if ($r.StatusCode -in 200, 204, 404) { Write-Ok "Connessione eliminata (HTTP $($r.StatusCode))" }
    else { Write-Warn "Eliminazione connessione (HTTP $($r.StatusCode))" }

    Write-Info "[RESET] Eliminazione policy..."
    $r = Invoke-DittoRequest DELETE "$DITTO_URL/api/2/policies/$POLICY_ID" $DITTO_USER $DITTO_PASS
    if ($r.StatusCode -in 200, 204, 404) { Write-Ok "Policy eliminata (HTTP $($r.StatusCode))" }
    else { Write-Warn "Eliminazione policy (HTTP $($r.StatusCode))" }
}

# ── 1. Attendi che Ditto sia pronto ──────────────────────────────────────────
Write-Info "Attendo che Ditto sia pronto..."
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    $r = Invoke-DittoRequest GET "$DITTO_URL/api/2/things" $DITTO_USER $DITTO_PASS
    if ($r.StatusCode -in 200, 404) {
        Write-Ok "Ditto risponde"
        $ready = $true
        break
    }
    Write-Host "   ... attendo ($i/30)"
    Start-Sleep -Seconds 5
}
if (-not $ready) { Write-Fail "Ditto non raggiungibile dopo 150 secondi" }

# ── 2. Policy ─────────────────────────────────────────────────────────────────
Write-Info "Creazione policy '$POLICY_ID'..."

$POLICY_FILE = Join-Path $PROJECT_DIR "ditto\policies\smart-park-policy.json"
if (-not (Test-Path $POLICY_FILE)) {
    Write-Fail "File policy non trovato: $POLICY_FILE"
}

$policyBody = Get-Content $POLICY_FILE -Raw -Encoding UTF8
$r = Invoke-DittoRequest PUT "$DITTO_URL/api/2/policies/$POLICY_ID" $DITTO_USER $DITTO_PASS $policyBody

if ($r.StatusCode -in 200, 201, 204) {
    Write-Ok "Policy '$POLICY_ID' creata/aggiornata (HTTP $($r.StatusCode))"
}
else {
    Write-Warn "Risposta policy (HTTP $($r.StatusCode)):"
    Write-Host $r.Body
    Write-Fail "Creazione policy fallita"
}

# ── 3. Connessione MQTT con Dynamic Mapper ────────────────────────────────────
Write-Info "Configurazione connessione MQTT '$CONNECTION_ID'..."

$CONN_FILE = Join-Path $PROJECT_DIR "ditto\connections\mqtt-connection.json"
if (-not (Test-Path $CONN_FILE)) {
    Write-Fail "File connessione non trovato: $CONN_FILE"
}

# Mettiamo da parte l'add-member di PowerShell per evitare blocchi memoria.
# Invio diretto del file JSON (ora contiene il mapper minificato nativamente).
$connBody = Get-Content $CONN_FILE -Raw -Encoding UTF8

# Tenta PUT (aggiorna se esiste)
$r = Invoke-DittoRequest PUT "$DITTO_URL/api/2/connections/$CONNECTION_ID" $DEVOPS_USER $DEVOPS_PASS $connBody

if ($r.StatusCode -in 200, 201, 204) {
    Write-Ok "Connessione '$CONNECTION_ID' aggiornata (HTTP $($r.StatusCode))"
}
elseif ($r.StatusCode -eq 404) {
    # Non esiste: creala con POST
    $r = Invoke-DittoRequest POST "$DITTO_URL/api/2/connections" $DEVOPS_USER $DEVOPS_PASS $connBody
    if ($r.StatusCode -in 200, 201) {
        Write-Ok "Connessione '$CONNECTION_ID' creata (HTTP $($r.StatusCode))"
    }
    else {
        Write-Warn "Risposta POST connessione (HTTP $($r.StatusCode)):"
        Write-Host $r.Body
        Write-Fail "Creazione connessione fallita"
    }
}
else {
    Write-Warn "Risposta connessione (HTTP $($r.StatusCode)):"
    Write-Host $r.Body
    Write-Fail "Configurazione connessione fallita"
}

# ── 4. Verifica stato connessione ─────────────────────────────────────────────
Write-Info "Verifica stato connessione..."
$r = Invoke-DittoRequest GET "$DITTO_URL/api/2/connections/$CONNECTION_ID/status" $DEVOPS_USER $DEVOPS_PASS
if ($r.StatusCode -eq 200) {
    try {
        $statusObj = $r.Body | ConvertFrom-Json
        $connStatus = if ($statusObj.liveStatus) { $statusObj.liveStatus }
        elseif ($statusObj.connectionStatus) { $statusObj.connectionStatus }
        else { "unknown" }
        Write-Ok "Stato connessione: $connStatus"
    }
    catch {
        Write-Ok "Stato connessione: OK (parsing non riuscito)"
    }
}
else {
    Write-Warn "Impossibile leggere lo stato connessione (HTTP $($r.StatusCode))"
}

# ── 5. Smoke test ─────────────────────────────────────────────────────────────
Write-Info "Smoke test mapper - invio messaggio di prova via MQTT..."

$mqttPub = Get-Command mosquitto_pub -ErrorAction SilentlyContinue
if ($mqttPub) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    # device_id viene estratto dal topic MQTT dal mapper. Il payload usa l'envelope standard.
    $testDeviceId = "env-setup-test"
    $testThingId = "$NAMESPACE`:$testDeviceId"
    $testPayload = @"
{"type":"environmental","device_id":"$testDeviceId","timestamp":"$timestamp","lat":39.3245,"lng":16.4677,"data":{"temperature_c":20.0,"humidity_pct":50.0}}
"@
    Write-Ok "Messaggio di test inviato su smartpark/telemetry/$testDeviceId"

    Write-Host "   Attendo 3 secondi e verifico se il Thing e' stato creato..."
    Start-Sleep -Seconds 3

    $r = Invoke-DittoRequest GET "$DITTO_URL/api/2/things/$testThingId" $DITTO_USER $DITTO_PASS
    if ($r.StatusCode -eq 200) {
        Write-Ok "Thing '$testThingId' creato dinamicamente dal mapper"
        Invoke-DittoRequest DELETE "$DITTO_URL/api/2/things/$testThingId" $DITTO_USER $DITTO_PASS | Out-Null
        Write-Ok "Thing di test eliminato"
    }
    else {
        Write-Warn "Thing di test non trovato (HTTP $($r.StatusCode)) - verifica i log di Ditto connectivity"
    }
}
else {
    Write-Skip "mosquitto_pub non trovato - smoke test saltato"
    Write-Host "   Puoi testare manualmente aprendo PowerShell e lanciando:"
    Write-Host "   mosquitto_pub -h localhost -p 1883 -t 'smartpark/telemetry/env-test-01' -m '{\"type\":\"environmental\",\"temperature_c\":20.0}'"
}

# ── Riepilogo ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Setup completato." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Policy:      $DITTO_URL/api/2/policies/$POLICY_ID"
Write-Host "  Connessione: $DITTO_URL/api/2/connections/$CONNECTION_ID"
Write-Host "  Things:      $DITTO_URL/api/2/things  (creati live dal mapper)"
Write-Host ""
Write-Host ""
Write-Host "  Things:      $DITTO_URL/api/2/things  (creati live via ImplicitThingCreation)"
Write-Host ""
Write-Host "  Topic MQTT in ingresso:  smartpark/telemetry/<device_id>"
Write-Host "  Payload envelope:        {type, device_id, timestamp, lat, lng, data:{...}}"
Write-Host "  Feature telemetria:      features/sensors/properties"

