"""
Simulatore di eventi sentiment per il dashboard Smart Park.
Invia POST a /sentiment ogni 10 secondi con dati casuali per le 3 zone.
"""
import time
import random
import requests

API_URL = "http://localhost:8000/sentiment"

ZONES = ["nord", "centro", "sud"]

SENTIMENTS = [
    ("positive", 0.7, 0.95),
    ("neutral",  0.4, 0.7),
    ("negative", 0.6, 0.9),
]

ACTIONS = [
    "Persone che passeggiano",
    "Bambini che giocano",
    "Jogging",
    "Picnic in corso",
    "Persone sedute sulle panchine",
    "Comportamento anomalo rilevato",
    "Area affollata",
    "Area tranquilla",
    "Ciclisti in transito",
]

DESCRIPTIONS = {
    "positive": [
        "Atmosfera rilassata, visitatori soddisfatti",
        "Alta affluenza, interazioni positive",
        "Famiglie con bambini, ambiente sereno",
    ],
    "neutral": [
        "Traffico normale di visitatori",
        "Nessun evento rilevante in corso",
        "Attività ordinaria nel parco",
    ],
    "negative": [
        "Comportamento molesto rilevato",
        "Assembramento non autorizzato",
        "Visitatori in stato di agitazione",
    ],
}


def simulate():
    print(f"Simulatore sentiment avviato → {API_URL}")
    print("Invio dati ogni 10 secondi. Ctrl+C per fermare.\n")

    while True:
        for zone in ZONES:
            sentiment_entry = random.choice(SENTIMENTS)
            sentiment = sentiment_entry[0]
            score = round(random.uniform(sentiment_entry[1], sentiment_entry[2]), 2)

            payload = {
                "zone":        zone,
                "sentiment":   sentiment,
                "score":       score,
                "action":      random.choice(ACTIONS),
                "description": random.choice(DESCRIPTIONS[sentiment]),
            }

            try:
                r = requests.post(API_URL, json=payload, timeout=3)
                print(f"[{zone:8s}] {sentiment:8s} ({score:.0%}) → {r.status_code}")
            except Exception as e:
                print(f"[{zone:8s}] Errore: {e}")

        print("---")
        time.sleep(10)


if __name__ == "__main__":
    simulate()
