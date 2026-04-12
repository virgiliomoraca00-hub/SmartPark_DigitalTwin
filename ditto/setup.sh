#!/usr/bin/env bash
# ============================================================
#  DITTO SETUP — Smart Park
#  Crea policy, things e connessione MQTT su Eclipse Ditto.
#  Eseguire una sola volta dopo aver avviato lo stack Docker.
#
#  Uso: bash ditto/setup.sh
# ============================================================

set -e

DITTO_URL="http://localhost:8080"
DITTO_USER="ditto"
DITTO_PASS="ditto"
DIR="$(cd "$(dirname "$0")" && pwd)"

ok()   { echo "  ✅  $*"; }
fail() { echo "  ❌  $*"; exit 1; }
info() { echo ""; echo "▶  $*"; }

# ── attendi che Ditto sia pronto ────────────────────────────
info "Attendo che Ditto sia pronto..."
for i in $(seq 1 30); do
    if curl -sf -u "$DITTO_USER:$DITTO_PASS" "$DITTO_URL/api/2/things" > /dev/null 2>&1; then
        ok "Ditto risponde"
        break
    fi
    echo "   ... attendo ($i/30)"
    sleep 5
done

# ── 1. Policy ───────────────────────────────────────────────
info "Creazione policy..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "$DITTO_URL/api/2/policies/smart-park:policy" \
    -u "$DITTO_USER:$DITTO_PASS" \
    -H "Content-Type: application/json" \
    -d @"$DIR/policies/smart-park-policy.json")
[[ "$STATUS" =~ ^(200|201|204)$ ]] && ok "Policy creata (HTTP $STATUS)" || fail "Policy fallita (HTTP $STATUS)"

# ── 2. Things ───────────────────────────────────────────────
info "Creazione Things..."
for THING in sensor-entrance sensor-lake sensor-playground; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PUT "$DITTO_URL/api/2/things/smart-park:$THING" \
        -u "$DITTO_USER:$DITTO_PASS" \
        -H "Content-Type: application/json" \
        -d @"$DIR/things/$THING.json")
    [[ "$STATUS" =~ ^(200|201|204)$ ]] && ok "Thing '$THING' creato (HTTP $STATUS)" || fail "Thing '$THING' fallito (HTTP $STATUS)"
done

# ── 3. Connessione MQTT ─────────────────────────────────────
info "Creazione connessione MQTT → Ditto..."
STATUS=$(curl -s -o /tmp/ditto_conn_resp.json -w "%{http_code}" \
    -X POST "$DITTO_URL/api/2/connections" \
    -u "devops:devops" \
    -H "Content-Type: application/json" \
    -d @"$DIR/connections/mqtt-connection.json")
if [[ "$STATUS" =~ ^(200|201)$ ]]; then
    ok "Connessione MQTT creata (HTTP $STATUS)"
elif [[ "$STATUS" == "409" ]]; then
    ok "Connessione MQTT già esistente (HTTP $STATUS)"
else
    echo "  ⚠️   Risposta connessione (HTTP $STATUS):"
    cat /tmp/ditto_conn_resp.json
fi

echo ""
echo "════════════════════════════════════════"
echo "  Setup completato."
echo "  I Digital Twin sono pronti su:"
echo "  $DITTO_URL/api/2/things"
echo "════════════════════════════════════════"
