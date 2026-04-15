from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import influxdb_client
import os

app = FastAPI(title="Smart Park API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# InfluxDB config
INFLUX_URL   = os.getenv("INFLUX_URL",   "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "smart-park-token-12345")
INFLUX_ORG   = os.getenv("INFLUX_ORG",   "smart-park")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "sensor-data")

influx = influxdb_client.InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
query_api = influx.query_api()
write_api = influx.write_api()


# ---------- Modelli ----------

class SentimentEvent(BaseModel):
    zone: str                        # nord | centro | sud
    sentiment: str                   # positive | neutral | negative
    score: float                     # 0.0 - 1.0
    action: Optional[str] = None
    description: Optional[str] = None


# ---------- Sentiment ----------

@app.post("/sentiment")
def post_sentiment(event: SentimentEvent):
    """Riceve un evento sentiment dall'esterno (CV/NLP team)."""
    point = (
        influxdb_client.Point("sentiment_data")
        .tag("zone", event.zone)
        .field("sentiment", event.sentiment)
        .field("score", event.score)
        .field("action", event.action or "")
        .field("description", event.description or "")
        .time(datetime.now(timezone.utc))
    )
    write_api.write(bucket=INFLUX_BUCKET, record=point)
    return {"status": "ok"}


@app.get("/sentiment/latest")
def get_sentiment_latest():
    """Restituisce l'ultimo evento sentiment per ogni zona."""
    query = f'''
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "sentiment_data")
      |> last()
      |> pivot(rowKey: ["_time", "zone"], columnKey: ["_field"], valueColumn: "_value")
    '''
    try:
        tables = query_api.query(query)
        result = {}
        for table in tables:
            for record in table.records:
                zone = record.values.get("zone")
                if zone:
                    result[zone] = {
                        "sentiment":   record.values.get("sentiment"),
                        "score":       record.values.get("score"),
                        "action":      record.values.get("action"),
                        "description": record.values.get("description"),
                        "timestamp":   record.get_time().isoformat(),
                    }
        return result
    except Exception:
        return {}


# ---------- Storico sensori ----------

@app.get("/history/{sensor_id}")
def get_history(sensor_id: str, metric: str = "temperature"):
    """Restituisce lo storico degli ultimi 30 minuti per un sensore e metrica."""
    valid_metrics = {"temperature", "humidity", "air_quality", "motion", "noise"}
    if metric not in valid_metrics:
        raise HTTPException(status_code=400, detail="Metrica non valida")

    query = f'''
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: -30m)
      |> filter(fn: (r) => r._measurement == "sensor_reading")
      |> filter(fn: (r) => r.sensor_id == "{sensor_id}")
      |> filter(fn: (r) => r._field == "{metric}")
      |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
    '''
    try:
        tables = query_api.query(query)
        result = []
        for table in tables:
            for record in table.records:
                result.append({
                    "time":  record.get_time().strftime("%H:%M"),
                    "value": round(record.get_value(), 2) if record.get_value() else None,
                })
        return result
    except Exception:
        return []


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
