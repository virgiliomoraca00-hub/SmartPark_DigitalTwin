// --- 1. CONFIGURAZIONE MAPPA (Basata su attributes.type) ---
export const sensorTypesMap = {
  "vision": {
    label: "Telecamera AI",
    color: "#679b65ff",     // Blu per la mappa
    mapMarkerIcon: "📷",  // Icona per il pin sulla mappa
    defaultRadius: 15
  },
  "sentimentAnalysis": {
    label: "Analisi Audio",
    color: "#8b5cf6",     // Viola
    mapMarkerIcon: "🎤",
    defaultRadius: 10
  },
  "activityRecognition": {
    label: "Visitatore (Wearable)",
    color: "#ef4444",     // Rosso
    mapMarkerIcon: "🏃",
    defaultRadius: 5
  },
  "environmental": {
    label: "Sensore Ambientale",
    color: "#22d3ee",     // Cyan
    mapMarkerIcon: "🌿",
    defaultRadius: 10
  },

  "default": {
    label: "Dispositivo Sconosciuto",
    color: "#9ca3af",     // Grigio
    mapMarkerIcon: "📍",
    defaultRadius: 10
  }
};

// --- 2. DIZIONARIO METRICHE (Basato sulle chiavi di properties) ---
export const telemetryDictionary = {
  // Metriche Vision
  "person_count": { label: "Persone Rilevate", unit: "", icon: "👥" },
  "crowd_density": { label: "Densità Folla", unit: "", icon: "📊" },
  "activity": { label: "Attività Rilevata", unit: "", icon: "🎬" },
  "confidence": { label: "Affidabilità AI", unit: "", icon: "🧠" },
  "objects_detected": { label: "Oggetti", unit: "", icon: "📦" },
  "anomaly_detected": { label: "Anomalia", unit: "", icon: "⚠️" },
  "anomaly_score": { label: "Score Anomalia", unit: "", icon: "📈" },
  "dominant_emotion": { label: "Emozione Predominante", unit: "", icon: "🎭" },

  // Metriche Ambientali
  "temperature": { label: "Temperatura", unit: "°C", icon: "🌡️", color: "red" },
  "temperature_c": { label: "Temperatura", unit: "°C", icon: "🌡️", color: "red" },
  "humidity": { label: "Umidità", unit: "%", icon: "💧", color: "blue" },
  "humidity_pct": { label: "Umidità", unit: "%", icon: "💧", color: "blue" },
  "co2_ppm": { label: "Livello CO2", unit: "ppm", icon: "☁️", color: "grey" },
  "air_quality": { label: "Qualità Aria", unit: "AQI", icon: "🍃", color: "green" },
  "noise": { label: "Rumore", unit: "dB", icon: "🔊", color: "yellow" },

  // Metriche Sentiment
  "sentiment": { label: "Sentiment", unit: "", icon: "💬" },
  "sentiment_score": { label: "Punteggio Sentiment", unit: "", icon: "⚖️" },
  "speech_detected": { label: "Voce Rilevata", unit: "", icon: "🗣️" },
  "language": { label: "Lingua", unit: "", icon: "🌍" },
  "transcript": { label: "Trascrizione", unit: "", icon: "📝" },
  "location": { label: "Zona di Rilevamento", unit: "", icon: "🗺️" },

  // Metriche Activity Recognition
  "heart_rate_bpm": { label: "Battito Cardiaco", unit: "bpm", icon: "❤️" },
  "gsr_kohm": { label: "Resistenza Galvanica", unit: "kΩ", icon: "⚡" },
  "activity_label": { label: "Stato Visitatore", unit: "", icon: "🚶" },
  "steps_total": { label: "Passi Totali", unit: "", icon: "👟" },

  // Coordinate
  "lat": { label: "Latitudine", unit: "°", icon: "🌐" },
  "lng": { label: "Longitudine", unit: "°", icon: "🌐" }
};

// Funzioni Helper per estrarre la configurazione in modo sicuro
export const getTypeConfig = (type) => {
  return sensorTypesMap[type] || sensorTypesMap["default"];
};

export const getTelemetryMeta = (key) => {
  return telemetryDictionary[key] || { label: key, unit: "", icon: "🔹" };
};
