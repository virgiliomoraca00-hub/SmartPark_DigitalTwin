#!/usr/bin/env bash
# ============================================================
#  DITTO SETUP — Smart Park  (v2 — Dynamic Mapper)
#
#  Crea policy e connessione MQTT su Eclipse Ditto.
#  I Things vengono creati DINAMICAMENTE dal mapper JavaScript
#  al primo messaggio MQTT ricevuto da ogni sensore.
#
#  NON crea Things statici — li gestisce il mapper.
#
#  Uso:  bash ditto/setup.sh
#  Flag: bash ditto/setup.sh --reset   elimina tutto e ricrea
# ============================================================

set -e

DITTO_URL="http://localhost:8080"
DITTO_USER="ditto"
DITTO_PASS="ditto"
DEVOPS_USER="devops"
DEVOPS_PASS="devops"
NAMESPACE="smartpark"
POLICY_ID="${NAMESPACE}:sensors-policy"
CONNECTION_ID="${NAMESPACE}-mqtt-connection"
DIR="$(cd "$(dirname "$0")" && pwd)"

ok()    { echo "  ✅  $*"; }
fail()  { echo "  ❌  $*" >&2; exit 1; }
info()  { echo ""; echo "▶  $*"; }
warn()  { echo "  ⚠️   $*"; }
skip()  { echo "  ⏭   $*"; }

# ── Flag --reset ─────────────────────────────────────────────────────────────
RESET=false
[[ "${1:-}" == "--reset" ]] && RESET=true

# ── Helper HTTP ──────────────────────────────────────────────────────────────
# Esegue una chiamata curl e restituisce il codice HTTP.
# Salva il body della risposta in /tmp/ditto_last_response.json.
ditto_request() {
    local method="$1"
    local url="$2"
    local user="$3"
    local pass="$4"
    local data="${5:-}"

    if [[ -n "$data" ]]; then
        curl -s -o /tmp/ditto_last_response.json -w "%{http_code}" \
            -X "$method" "$url" \
            -u "$user:$pass" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -o /tmp/ditto_last_response.json -w "%{http_code}" \
            -X "$method" "$url" \
            -u "$user:$pass"
    fi
}

# ── Attendi che Ditto sia pronto ─────────────────────────────────────────────
info "Attendo che Ditto sia pronto..."
for i in $(seq 1 30); do
    if curl -sf -u "$DITTO_USER:$DITTO_PASS" \
            "$DITTO_URL/api/2/things" > /dev/null 2>&1; then
        ok "Ditto risponde"
        break
    fi
    echo "   ... attendo ($i/30)"
    sleep 5
    [[ $i -eq 30 ]] && fail "Ditto non raggiungibile dopo 150 secondi"
done

# ── --reset: elimina connessione e policy esistenti ──────────────────────────
if [[ "$RESET" == true ]]; then
    info "[RESET] Eliminazione connessione MQTT..."
    STATUS=$(ditto_request DELETE \
        "$DITTO_URL/api/2/connections/$CONNECTION_ID" \
        "$DEVOPS_USER" "$DEVOPS_PASS")
    [[ "$STATUS" =~ ^(200|204|404)$ ]] \
        && ok "Connessione eliminata (HTTP $STATUS)" \
        || warn "Eliminazione connessione (HTTP $STATUS)"

    info "[RESET] Eliminazione policy..."
    STATUS=$(ditto_request DELETE \
        "$DITTO_URL/api/2/policies/$POLICY_ID" \
        "$DITTO_USER" "$DITTO_PASS")
    [[ "$STATUS" =~ ^(200|204|404)$ ]] \
        && ok "Policy eliminata (HTTP $STATUS)" \
        || warn "Eliminazione policy (HTTP $STATUS)"
fi

# ── 1. Policy ────────────────────────────────────────────────────────────────
info "Creazione policy '${POLICY_ID}'..."

POLICY_FILE="$DIR/policies/smartpark-sensors-policy.json"
[[ -f "$POLICY_FILE" ]] || fail "File policy non trovato: $POLICY_FILE"

STATUS=$(ditto_request PUT \
    "$DITTO_URL/api/2/policies/$POLICY_ID" \
    "$DITTO_USER" "$DITTO_PASS" \
    "@$POLICY_FILE")

if [[ "$STATUS" =~ ^(200|201|204)$ ]]; then
    ok "Policy '${POLICY_ID}' creata/aggiornata (HTTP $STATUS)"
else
    warn "Policy (HTTP $STATUS):"
    cat /tmp/ditto_last_response.json
    fail "Creazione policy fallita"
fi

# ── 2. Connessione MQTT con Dynamic Mapper ───────────────────────────────────
info "Configurazione connessione MQTT '${CONNECTION_ID}'..."

CONN_FILE="$DIR/connections/mqtt-connection.json"
[[ -f "$CONN_FILE" ]] || fail "File connessione non trovato: $CONN_FILE"

# Inietta l'id nella connessione a runtime (evita di hardcodarlo nel json)
CONN_PAYLOAD=$(python3 -c "
import json, sys
with open('$CONN_FILE') as f:
    conn = json.load(f)
conn['id'] = '$CONNECTION_ID'
print(json.dumps(conn))
") || fail "Errore nel parsing di mqtt-connection.json"

# Prova prima a fare PUT (aggiorna se esiste)
STATUS=$(ditto_request PUT \
    "$DITTO_URL/api/2/connections/$CONNECTION_ID" \
    "$DEVOPS_USER" "$DEVOPS_PASS" \
    "$CONN_PAYLOAD")

if [[ "$STATUS" =~ ^(200|204)$ ]]; then
    ok "Connessione '${CONNECTION_ID}' aggiornata (HTTP $STATUS)"
elif [[ "$STATUS" == "404" ]]; then
    # Non esiste ancora: creala con POST
    STATUS=$(ditto_request POST \
        "$DITTO_URL/api/2/connections" \
        "$DEVOPS_USER" "$DEVOPS_PASS" \
        "$CONN_PAYLOAD")
    if [[ "$STATUS" =~ ^(200|201)$ ]]; then
        ok "Connessione '${CONNECTION_ID}' creata (HTTP $STATUS)"
    else
        warn "Risposta POST connessione (HTTP $STATUS):"
        cat /tmp/ditto_last_response.json
        fail "Creazione connessione fallita"
    fi
else
    warn "Risposta connessione (HTTP $STATUS):"
    cat /tmp/ditto_last_response.json
    fail "Configurazione connessione fallita"
fi

# ── 3. Verifica stato connessione ────────────────────────────────────────────
info "Verifica stato connessione..."
STATUS=$(ditto_request GET \
    "$DITTO_URL/api/2/connections/$CONNECTION_ID/status" \
    "$DEVOPS_USER" "$DEVOPS_PASS")

if [[ "$STATUS" == "200" ]]; then
    CONN_STATUS=$(python3 -c "
import json
with open('/tmp/ditto_last_response.json') as f:
    d = json.load(f)
print(d.get('liveStatus', d.get('connectionStatus', 'unknown')))
" 2>/dev/null || echo "unknown")
    ok "Stato connessione: $CONN_STATUS"
else
    warn "Impossibile leggere lo stato connessione (HTTP $STATUS)"
fi

# ── 4. Smoke test: verifica che il mapper risponda ───────────────────────────
info "Smoke test mapper — invio messaggio di prova via MQTT..."

# Controlla se mosquitto_pub è disponibile
if command -v mosquitto_pub > /dev/null 2>&1; then
    TEST_PAYLOAD='{
      "device_id": "env-setup-test",
      "type": "environmental",
      "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'",
      "data": { "temperature_c": 20.0, "humidity_pct": 50.0 }
    }'
    mosquitto_pub \
        -h localhost -p 1883 \
        -t "smartpark/telemetry/env-setup-test" \
        -m "$TEST_PAYLOAD" && ok "Messaggio di test inviato su smartpark/telemetry/env-setup-test"

    echo "   Attendo 3 secondi e verifico se il Thing è stato creato..."
    sleep 3

    STATUS=$(ditto_request GET \
        "$DITTO_URL/api/2/things/${NAMESPACE}:env-setup-test" \
        "$DITTO_USER" "$DITTO_PASS")
    if [[ "$STATUS" == "200" ]]; then
        ok "Thing '${NAMESPACE}:env-setup-test' creato dinamicamente dal mapper ✨"
        # Pulizia thing di test
        ditto_request DELETE \
            "$DITTO_URL/api/2/things/${NAMESPACE}:env-setup-test" \
            "$DITTO_USER" "$DITTO_PASS" > /dev/null
        ok "Thing di test eliminato"
    else
        warn "Thing di test non trovato (HTTP $STATUS) — verifica i log di Ditto connectivity"
    fi
else
    skip "mosquitto_pub non trovato — smoke test saltato"
    echo "   Puoi testare manualmente con:"
    echo "   mosquitto_pub -h localhost -p 1883 \\"
    echo "     -t 'smartpark/telemetry/env-test-01' \\"
    echo "     -m '{\"device_id\":\"env-test-01\",\"type\":\"environmental\",\"data\":{\"temperature_c\":20}}'"
fi

# ── Riepilogo ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Setup completato."
echo ""
echo "  Policy:      $DITTO_URL/api/2/policies/$POLICY_ID"
echo "  Connessione: $DITTO_URL/api/2/connections/$CONNECTION_ID"
echo "  Things:      $DITTO_URL/api/2/things  (creati live dal mapper)"
echo ""
echo "  Topic MQTT in ingresso:  smartpark/telemetry/#"
echo "  Topic eventi:            smartpark/events/<thingId>"
echo "  Topic errori:            smartpark/errors/<thingId>"
echo ""
echo "  Per resettare tutto:     bash ditto/setup.sh --reset"
echo "════════════════════════════════════════════════════════"
