// --- 1. CONFIGURAZIONE MAPPA (Basata su attributes.type) ---
export const sensorTypesMap = {
  // Legacy names (vecchi flows)
  "vision": {
    label: "Telecamera AI",
    color: "#679b65ff",     // Verde
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
    color: "#f97316",     // Arancione
    mapMarkerIcon: "🏃",
    defaultRadius: 5
  },

  // Current names (nuovi flows)
  "camera": {
    label: "Telecamera AI",
    color: "#679b65ff",     // Verde
    mapMarkerIcon: "📷",
    defaultRadius: 15
  },
  "audio": {
    label: "Analisi Audio",
    color: "#8b5cf6",     // Viola
    mapMarkerIcon: "🎤",
    defaultRadius: 10
  },
  "wearable": {
    label: "Visitatore (Wearable)",
    color: "#f97316",     // Arancione
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
  "light":       { label: "Luminosità",     unit: "lux", icon: "💡", color: "yellow" },
  "pressure":    { label: "Pressione",      unit: "Pa",  icon: "🔽", color: "blue"   },

  // Metriche EG5120 (gateway industriale Robustel)
  "tof":                  { label: "Distanza ToF",          unit: "mm",  icon: "📏" },
  "angle":                { label: "Angolo",                unit: "°",   icon: "📐" },
  "accX":                 { label: "Accelerazione X",       unit: "mg",  icon: "📊" },
  "accY":                 { label: "Accelerazione Y",       unit: "mg",  icon: "📊" },
  "accZ":                 { label: "Accelerazione Z",       unit: "mg",  icon: "📊" },
  "vibrAccX":             { label: "Vibrazione X",          unit: "g",   icon: "〰️" },
  "vibrAccY":             { label: "Vibrazione Y",          unit: "g",   icon: "〰️" },
  "vibrAccZ":             { label: "Vibrazione Z",          unit: "g",   icon: "〰️" },
  "prediction_confidence":{ label: "Confidenza Previsione", unit: "%",   icon: "🧠" },
  "weather_prediction":   { label: "Previsione Meteo",      unit: "",    icon: "🌤️" },
  "prediction_time":      { label: "Tempo Previsione",      unit: "s",   icon: "⏱️" },
  "status":               { label: "Stato",                 unit: "",    icon: "🚶" },

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
  return telemetryDictionary[key] || { label: key.replace(/_/g, ' '), unit: '', icon: '🔹' }
}

// --- 3. DIZIONARIO DESIRED PROPERTIES (Controllo bidirezionale) ---
// Associa ogni chiave di desiredProperties a: etichetta, icona, tipo widget, e parametri.
// I widget supportati sono: 'toggle' (bool), 'slider' (number), 'select' (enum), 'text' (fallback)
export const DESIRED_META = {
  // ── Comuni a tutti i tipi ────────────────────────────────────────────────
  alert_active: {
    label: 'Stato Allerta', icon: '🚨', widget: 'toggle',
    description: 'Attiva la simulazione di emergenza per questo sensore'
  },
  sampling_rate_s: {
    label: 'Frequenza campionamento', icon: '⏱️', widget: 'slider', unit: 's',
    min: 5, max: 300, step: 5,
    description: 'Intervallo in secondi tra un campionamento e il successivo'
  },

  // ── Environmental ─────────────────────────────────────────────────────────
  alert_threshold_temp: {
    label: 'Soglia temperatura allerta', icon: '🌡️', widget: 'slider', unit: '°C',
    min: 20, max: 80, step: 1,
    description: 'Temperatura sopra cui viene segnalata un\'anomalia'
  },

  // ── Vision / Camera ───────────────────────────────────────────────────────
  tracking_mode: {
    label: 'Modalità tracking', icon: '📷', widget: 'select',
    options: ['person', 'crowd', 'anomaly', 'disabled'],
    optionLabels: { person: 'Persone', crowd: 'Folla', anomaly: 'Anomalie', disabled: 'Disabilitato' },
    description: 'Seleziona cosa monitorare con la telecamera AI'
  },
  confidence_threshold: {
    label: 'Soglia confidenza AI', icon: '🧠', widget: 'slider', unit: '%',
    min: 0.5, max: 1.0, step: 0.05,
    description: 'Valore minimo di confidenza per segnalare un rilevamento'
  },
  night_mode: {
    label: 'Modalità notturna', icon: '🌙', widget: 'toggle',
    description: 'Attiva il filtro infrarosso per la visione notturna'
  },
  frame_rate_fps: {
    label: 'Frame rate', icon: '🎞️', widget: 'slider', unit: 'fps',
    min: 1, max: 30, step: 1,
    description: 'Numero di fotogrammi al secondo elaborati'
  },

  // ── Audio / Microfono ─────────────────────────────────────────────────────
  sensitivity: {
    label: 'Sensibilità microfono', icon: '🎤', widget: 'slider',
    min: 0, max: 1.0, step: 0.1,
    description: 'Livello di sensibilità del microfono (0.0 = minima, 1.0 = massima)'
  },
  noise_threshold_db: {
    label: 'Soglia rumore allerta', icon: '🔊', widget: 'slider', unit: 'dB',
    min: 40, max: 100, step: 5,
    description: 'Livello di rumore dB oltre cui scatta l\'allerta audio'
  },

  // ── Wearable / Shimmer ────────────────────────────────────────────────────
  sampling_rate_hz: {
    label: 'Frequenza campionamento', icon: '⚡', widget: 'slider', unit: 'Hz',
    min: 1, max: 50, step: 1,
    description: 'Frequenza di campionamento dei sensori IMU (Hz)'
  },
  vibration_alert_enabled: {
    label: 'Alert vibrazione', icon: '〰️', widget: 'toggle',
    description: 'Abilita gli avvisi quando si supera la soglia di vibrazione'
  },
  vibration_threshold: {
    label: 'Soglia vibrazione', icon: '📊', widget: 'slider', unit: 'g',
    min: 0.5, max: 10, step: 0.5,
    description: 'Intensità di vibrazione (g) oltre cui scatta l\'alert'
  },
}

export const getDesiredMeta = (key) => {
  return DESIRED_META[key] || { label: key.replace(/_/g, ' '), icon: '⚙️', widget: 'text' }
}
