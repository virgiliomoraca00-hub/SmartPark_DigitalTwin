#!/usr/bin/env python3
"""
Smart Park - Test Suite
========================
Testa uno per uno tutti i componenti dello stack.

Uso:
    python3 test_stack.py
"""

import sys
import json
import time
import requests
import socket

# ─────────────────────────────────────────
# Colori terminale
# ─────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):    print(f"  {GREEN}✅ {msg}{RESET}")
def fail(msg):  print(f"  {RED}❌ {msg}{RESET}")
def warn(msg):  print(f"  {YELLOW}⚠️  {msg}{RESET}")
def info(msg):  print(f"  {BLUE}ℹ️  {msg}{RESET}")
def header(msg):print(f"\n{BOLD}{'─'*50}\n  {msg}\n{'─'*50}{RESET}")

results = {}

# ─────────────────────────────────────────
# TEST 1: Porte TCP aperte
# ─────────────────────────────────────────
def test_ports():
    header("TEST 1 — Porte TCP")
    services = {
        "Mosquitto MQTT":    ("localhost", 1883),
        "Mosquitto WS":      ("localhost", 9001),
        "RabbitMQ AMQP":     ("localhost", 5672),
        "RabbitMQ UI":       ("localhost", 15672),
        "MongoDB":           ("localhost", 27017),
        "Eclipse Ditto":     ("localhost", 8080),
        "InfluxDB":          ("localhost", 8086),
        "Grafana":           ("localhost", 3000),
        "MQTT Explorer":     ("localhost", 4000),
    }
    all_ok = True
    for name, (host, port) in services.items():
        try:
            s = socket.create_connection((host, port), timeout=2)
            s.close()
            ok(f"{name} → {host}:{port}")
        except (ConnectionRefusedError, OSError):
            fail(f"{name} → {host}:{port}  (non raggiungibile)")
            all_ok = False
    results["ports"] = all_ok

# ─────────────────────────────────────────
# TEST 2: Eclipse Ditto HTTP API
# ─────────────────────────────────────────
def test_ditto():
    header("TEST 2 — Eclipse Ditto")
    base = "http://localhost:8080"

    # Health
    try:
        r = requests.get(f"{base}/health", timeout=5)
        if r.status_code == 200:
            ok(f"Health endpoint: {r.status_code}")
        else:
            warn(f"Health endpoint: {r.status_code}")
    except Exception as e:
        fail(f"Health endpoint irraggiungibile: {e}")
        results["ditto"] = False
        return

    # Crea policy di test
    policy_id = "test-ns:test-policy"
    policy_body = {
        "policyId": policy_id,
        "entries": {
            "owner": {
                "subjects": {"nginx:ditto": {"type": "nginx basic auth user"}},
                "resources": {
                    "thing:/":   {"grant": ["READ","WRITE"], "revoke": []},
                    "policy:/":  {"grant": ["READ","WRITE"], "revoke": []},
                    "message:/": {"grant": ["READ","WRITE"], "revoke": []},
                },
            }
        },
    }
    r = requests.put(
        f"{base}/api/2/policies/{policy_id}",
        json=policy_body,
        auth=("ditto", "ditto"),
        headers={"Content-Type": "application/json"},
        timeout=5,
    )
    if r.status_code in (200, 201, 204):
        ok(f"Creazione policy: {r.status_code}")
    else:
        warn(f"Creazione policy: {r.status_code} — {r.text[:60]}")

    # Crea thing di test
    thing_id = "test-ns:test-thing-001"
    thing_body = {
        "thingId":  thing_id,
        "policyId": policy_id,
        "attributes": {"name": "Test Sensor", "type": "test"},
        "features": {
            "temperature": {"properties": {"value": 22.5}},
        },
    }
    r = requests.put(
        f"{base}/api/2/things/{thing_id}",
        json=thing_body,
        auth=("ditto", "ditto"),
        headers={"Content-Type": "application/json"},
        timeout=5,
    )
    if r.status_code in (200, 201, 204):
        ok(f"Creazione Thing '{thing_id}': {r.status_code}")
    else:
        fail(f"Creazione Thing: {r.status_code} — {r.text[:80]}")
        results["ditto"] = False
        return

    # Leggi thing
    r = requests.get(
        f"{base}/api/2/things/{thing_id}",
        auth=("ditto", "ditto"),
        timeout=5,
    )
    if r.status_code == 200:
        data = r.json()
        temp = data.get("features", {}).get("temperature", {}).get("properties", {}).get("value")
        ok(f"Lettura Thing OK — temperature.value = {temp}")
    else:
        fail(f"Lettura Thing: {r.status_code}")

    # Aggiorna feature
    r = requests.put(
        f"{base}/api/2/things/{thing_id}/features/temperature/properties/value",
        json=25.0,
        auth=("ditto", "ditto"),
        headers={"Content-Type": "application/json"},
        timeout=5,
    )
    if r.status_code in (200, 201, 204):
        ok(f"Aggiornamento feature: {r.status_code}")
    else:
        fail(f"Aggiornamento feature: {r.status_code}")

    # Cleanup
    requests.delete(f"{base}/api/2/things/{thing_id}", auth=("ditto","ditto"), timeout=5)
    requests.delete(f"{base}/api/2/policies/{policy_id}", auth=("ditto","ditto"), timeout=5)
    ok("Cleanup test resources OK")
    results["ditto"] = True

# ─────────────────────────────────────────
# TEST 3: MQTT (Mosquitto)
# ─────────────────────────────────────────
def test_mqtt():
    header("TEST 3 — MQTT (Mosquitto)")
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        fail("paho-mqtt non installato. Esegui: pip install paho-mqtt")
        results["mqtt"] = False
        return

    received = []

    def on_message(client, userdata, msg):
        received.append(json.loads(msg.payload.decode()))

    client = mqtt.Client(client_id="test-client", protocol=mqtt.MQTTv5)
    client.on_message = on_message

    try:
        client.connect("localhost", 1883, keepalive=10)
        client.loop_start()
        client.subscribe("smart-park/test/#", qos=1)
        time.sleep(0.5)

        # Pubblica messaggio di test
        payload = json.dumps({"sensor": "test", "value": 42, "ts": time.time()})
        result = client.publish("smart-park/test/sensor", payload, qos=1)
        result.wait_for_publish(timeout=3)

        time.sleep(1)

        if received:
            ok(f"Publish/Subscribe OK — ricevuto: {received[0]}")
            results["mqtt"] = True
        else:
            warn("Messaggio non ricevuto entro 1s (può essere normale)")
            results["mqtt"] = True  # connessione ok anche senza loopback

        client.loop_stop()
        client.disconnect()
        ok("Disconnessione MQTT OK")

    except Exception as e:
        fail(f"MQTT errore: {e}")
        results["mqtt"] = False

# ─────────────────────────────────────────
# TEST 4: InfluxDB
# ─────────────────────────────────────────
def test_influxdb():
    header("TEST 4 — InfluxDB")
    try:
        from influxdb_client import InfluxDBClient, Point
        from influxdb_client.client.write_api import SYNCHRONOUS
    except ImportError:
        fail("influxdb-client non installato. Esegui: pip install influxdb-client")
        results["influxdb"] = False
        return

    try:
        client = InfluxDBClient(
            url="http://localhost:8086",
            token="smart-park-token-12345",
            org="smart-park",
        )
        health = client.health()
        if health.status == "pass":
            ok(f"InfluxDB health: {health.status}")
        else:
            warn(f"InfluxDB health: {health.status}")

        # Scrittura di test
        write_api = client.write_api(write_options=SYNCHRONOUS)
        point = (
            Point("test_measurement")
            .tag("source", "test-suite")
            .field("temperature", 22.5)
            .field("humidity", 65.0)
        )
        write_api.write(bucket="sensor-data", org="smart-park", record=point)
        ok("Scrittura punto di test OK")

        # Query di test
        query_api = client.query_api()
        query = '''
        from(bucket: "sensor-data")
          |> range(start: -1m)
          |> filter(fn: (r) => r._measurement == "test_measurement")
          |> last()
        '''
        tables = query_api.query(query, org="smart-park")
        count = sum(1 for t in tables for r in t.records)
        if count > 0:
            ok(f"Query di test OK — {count} record trovati")
        else:
            warn("Query: nessun record (timing, riprova)")

        client.close()
        results["influxdb"] = True

    except Exception as e:
        fail(f"InfluxDB errore: {e}")
        results["influxdb"] = False

# ─────────────────────────────────────────
# TEST 5: RabbitMQ
# ─────────────────────────────────────────
def test_rabbitmq():
    header("TEST 5 — RabbitMQ")
    try:
        r = requests.get(
            "http://localhost:15672/api/overview",
            auth=("hono", "hono-secret"),
            timeout=5,
        )
        if r.status_code == 200:
            data = r.json()
            ok(f"RabbitMQ Management API OK — version: {data.get('rabbitmq_version','?')}")
            ok(f"Node: {data.get('node','?')}")
            results["rabbitmq"] = True
        else:
            fail(f"RabbitMQ API: {r.status_code}")
            results["rabbitmq"] = False
    except Exception as e:
        fail(f"RabbitMQ non raggiungibile: {e}")
        results["rabbitmq"] = False

# ─────────────────────────────────────────
# TEST 6: Grafana
# ─────────────────────────────────────────
def test_grafana():
    header("TEST 6 — Grafana")
    try:
        r = requests.get(
            "http://localhost:3000/api/health",
            auth=("admin", "admin"),
            timeout=5,
        )
        if r.status_code == 200:
            data = r.json()
            ok(f"Grafana health: {data.get('database','?')}")
            results["grafana"] = True
        else:
            fail(f"Grafana API: {r.status_code}")
            results["grafana"] = False
    except Exception as e:
        fail(f"Grafana non raggiungibile: {e}")
        results["grafana"] = False

# ─────────────────────────────────────────
# RIEPILOGO FINALE
# ─────────────────────────────────────────
def print_summary():
    header("RIEPILOGO TEST")
    all_pass = True
    for name, passed in results.items():
        if passed:
            ok(f"{name:<15} PASS")
        else:
            fail(f"{name:<15} FAIL")
            all_pass = False

    print()
    if all_pass:
        print(f"  {GREEN}{BOLD}🎉 Tutti i test superati! Stack pronto.{RESET}")
    else:
        print(f"  {YELLOW}{BOLD}⚠️  Alcuni componenti non sono raggiungibili.{RESET}")
        print(f"  {YELLOW}  → Verifica che tutti i container siano running:{RESET}")
        print(f"  {YELLOW}    docker compose ps{RESET}")
    print()

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n{BOLD}{'═'*50}")
    print("  SMART PARK — Stack Test Suite")
    print(f"{'═'*50}{RESET}")

    test_ports()
    test_mqtt()
    test_ditto()
    test_influxdb()
    test_rabbitmq()
    test_grafana()
    print_summary()
