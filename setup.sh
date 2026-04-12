#!/bin/bash
# setup.sh — Inizializzazione Smart Park IoT Stack
# Genera le credenziali nginx e avvia docker compose

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║    SMART PARK — Setup iniziale               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 1. Crea cartelle necessarie
echo "📁 Creazione struttura cartelle..."
mkdir -p mosquitto/config
mkdir -p nginx
mkdir -p grafana/provisioning
mkdir -p scripts

# 2. Genera nginx.htpasswd con htpasswd o openssl
echo ""
echo "🔐 Generazione credenziali nginx (utente: ditto, password: ditto)..."

if command -v htpasswd &> /dev/null; then
    htpasswd -cb nginx/nginx.htpasswd ditto ditto
    htpasswd -b  nginx/nginx.htpasswd devops devops
    echo "  ✅ htpasswd generato con apache2-utils"
elif command -v openssl &> /dev/null; then
    HASH_DITTO=$(openssl passwd -apr1 ditto)
    HASH_DEVOPS=$(openssl passwd -apr1 devops)
    echo "ditto:${HASH_DITTO}" > nginx/nginx.htpasswd
    echo "devops:${HASH_DEVOPS}" >> nginx/nginx.htpasswd
    echo "  ✅ htpasswd generato con openssl"
else
    echo "  ⚠️  Né htpasswd né openssl trovati."
    echo "  Installa con: sudo apt install apache2-utils"
    exit 1
fi

# 3. Avvia lo stack
echo ""
echo "🐳 Avvio Docker Compose..."
sudo docker compose up -d

# 4. Attendi che i servizi siano pronti
echo ""
echo "⏳ Attendo che i servizi si avviino (90 secondi)..."
sleep 90

# 5. Status
echo ""
echo "📊 Stato container:"
sudo docker compose ps

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Stack avviato! Interfacce disponibili:      ║"
echo "║  Ditto API/UI  → http://localhost:8080       ║"
echo "║    user: ditto  pass: ditto                  ║"
echo "║  RabbitMQ UI   → http://localhost:15672      ║"
echo "║    user: hono   pass: hono-secret            ║"
echo "║  InfluxDB UI   → http://localhost:8086       ║"
echo "║    user: admin  pass: admin-secret           ║"
echo "║  Grafana       → http://localhost:3000       ║"
echo "║    user: admin  pass: admin                  ║"
echo "║  MQTT Explorer → http://localhost:4000       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "➡️  Per testare lo stack:"
echo "   source venv/bin/activate"
echo "   python3 scripts/test_stack.py"
