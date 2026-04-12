#!/usr/bin/env python3
"""
Smart Park - Sensor Simulator
==============================
Simula 3 sensori nel parco e pubblica i dati su MQTT (Mosquitto).

Il resto dell'infrastruttura si occupa di:
  - Telegraf  : sottoscritto a MQTT, scrive su InfluxDB
  - Ditto     : sottoscritto a MQTT (via mqtt-connection), aggiorna i Digital Twin

Requisiti:
    pip install paho-mqtt

Uso:
    python3 sensor_simulator.py
"""

import json
import time
import random
import math
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

# ─────────────────────────────────────────────────
# CONFIGURAZIONE
# ─────────────────────────────────────────────────

MQTT_HOST        = "localhost"
MQTT_PORT        = 1883
PUBLISH_INTERVAL = 5   # secondi tra ogni pubblicazione

# ─────────────────────────────────────────────────
# DEFINIZIONE SENSORI
# Ogni sensore = una zona del parco
# ─────────────────────────────────────────────────

SENSORS = [
    {"id": "sensor-entrance",   "name": "Ingresso Principale", "phase_offset": 0.0},
    {"id": "sensor-lake",       "name": "Area Lago",           "phase_offset": 0.5},
    {"id": "sensor-playground", "name": "Area Giochi",         "phase_offset": 1.0},
    {"id": "sensor-north-1",    "name": "Sentiero Nord",       "phase_offset": 1.5},
    {"id": "sensor-north-2",    "name": "Bosco Nord-Est",      "phase_offset": 2.0},
    {"id": "sensor-west",       "name": "Area Ovest",          "phase_offset": 2.5},
    {"id": "sensor-east",       "name": "Area Est",            "phase_offset": 3.0},
    {"id": "sensor-south-1",    "name": "Picnic Sud",          "phase_offset": 3.5},
    {"id": "sensor-south-2",    "name": "Parcheggio Sud",      "phase_offset": 4.0},
    {"id": "sensor-center",     "name": "Centro Parco",        "phase_offset": 4.5},
]

# ─────────────────────────────────────────────────
# GENERAZIONE DATI SIMULATI
# ─────────────────────────────────────────────────

def simulate_sensor_data(sensor_id: str, tick: int, phase_offset: float = 0.0) -> dict:
    """
    Genera dati realistici con variazioni sinusoidali
    per simulare cicli giornalieri + rumore casuale.
    """
    phase = (tick % 120) / 120 * 2 * math.pi + phase_offset

    # Temperatura: 15–28°C
    temperature = round(21.5 + 6.5 * math.sin(phase) + random.uniform(-0.5, 0.5), 2)

    # Umidità: 40–80%
    humidity = round(60.0 - 20.0 * math.sin(phase) + random.uniform(-2, 2), 2)

    # Qualità aria (CO2 ppm): 400–900
    air_quality = round(650 + 250 * math.sin(phase + 1) + random.uniform(-20, 20), 1)

    # Movimento (persone rilevate): 0–50
    motion = max(0, int(25 + 25 * math.sin(phase + 0.5) + random.uniform(-5, 5)))

    # Rumore (dB): 30–80
    noise = round(55 + 25 * math.sin(phase + 0.3) + random.uniform(-3, 3), 1)

    # Anomalia simulata: ~2% di probabilità, spike CO2
    anomaly = False
    if random.random() < 0.02:
        air_quality = round(air_quality * 1.8, 1)
        anomaly = True

    return {
        "sensor_id":   sensor_id,
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "temperature": temperature,
        "humidity":    humidity,
        "air_quality": air_quality,
        "motion":      motion,
        "noise":       noise,
        "anomaly":     anomaly,
    }

# ─────────────────────────────────────────────────
# MQTT — PUBBLICAZIONE MESSAGGI
# ─────────────────────────────────────────────────

mqtt_client    = mqtt.Client(client_id="sensor-simulator", protocol=mqtt.MQTTv5)
mqtt_connected = False


def on_connect(client, userdata, flags, rc, properties=None):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print("  ✅ MQTT connesso a Mosquitto")
    else:
        print(f"  ❌ MQTT connessione fallita, rc={rc}")


def on_disconnect(client, userdata, rc, properties=None):
    global mqtt_connected
    mqtt_connected = False
    print("  ⚠️  MQTT disconnesso")


def init_mqtt():
    mqtt_client.on_connect    = on_connect
    mqtt_client.on_disconnect = on_disconnect
    try:
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        mqtt_client.loop_start()
        time.sleep(1)
    except Exception as e:
        print(f"  ❌ MQTT errore connessione: {e}")


def publish_mqtt(sensor_id: str, data: dict):
    if not mqtt_connected:
        return
    topic   = f"smart-park/{sensor_id}/telemetry"
    payload = json.dumps(data)
    result  = mqtt_client.publish(topic, payload, qos=1)
    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        print(f"  ⚠️  MQTT publish error: {result.rc}")

# ─────────────────────────────────────────────────
# LOOP PRINCIPALE
# ─────────────────────────────────────────────────

def print_banner():
    print("""
╔══════════════════════════════════════════════════════╗
║       SMART PARK — Sensor Simulator v2.0             ║
║  MQTT    → localhost:1883                            ║
║  Telegraf  → MQTT → InfluxDB  (automatico)           ║
║  Ditto     → MQTT → Twin      (automatico)           ║
╚══════════════════════════════════════════════════════╝
    """)


def print_data(sensor: dict, data: dict):
    anomaly_flag = " 🚨 ANOMALIA!" if data["anomaly"] else ""
    print(
        f"  [{data['timestamp'][11:19]}] "
        f"{sensor['name']:<22} | "
        f"🌡 {data['temperature']:5.1f}°C | "
        f"💧 {data['humidity']:4.1f}% | "
        f"💨 CO2: {data['air_quality']:5.1f}ppm | "
        f"👥 {data['motion']:2d} | "
        f"🔊 {data['noise']:4.1f}dB"
        f"{anomaly_flag}"
    )


def main():
    print_banner()

    print("🔌 Connessione a Mosquitto...")
    init_mqtt()

    print(f"\n🚀 Inizio simulazione (intervallo: {PUBLISH_INTERVAL}s)\n")
    print("-" * 75)

    tick = 0
    try:
        while True:
            for sensor in SENSORS:
                data = simulate_sensor_data(sensor["id"], tick, sensor.get("phase_offset", 0.0))
                publish_mqtt(sensor["id"], data)
                print_data(sensor, data)

            tick += 1
            print()
            time.sleep(PUBLISH_INTERVAL)

    except KeyboardInterrupt:
        print("\n\n🛑 Simulazione interrotta dall'utente.")
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


if __name__ == "__main__":
    main()
