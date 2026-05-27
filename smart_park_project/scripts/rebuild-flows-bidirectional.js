/**
 * rebuild-flows-bidirectional.js
 *
 * Script DEFINITIVO che riscrive i func dei nodi Node-RED per:
 * 1. Usare la struttura `features: { sensors: { desiredProperties, properties }, motion, gateway }`
 * 2. Leggere lo stato desiderato da Ditto via `global.get('state_<deviceId>')`
 * 3. Aggiungere/aggiornare il nodo MQTT-in che ascolta `smartpark/events/#` 
 *    e salva i comandi nello stato globale
 */

const fs = require('fs');
const path = require('path');

const FLOWS_PATH = path.join(__dirname, '..', 'nodered_data', 'flows.json');
let flows = JSON.parse(fs.readFileSync(FLOWS_PATH, 'utf8'));

// ── HELPER ────────────────────────────────────────────────────────────────────
function setNode(id, func) {
  const node = flows.find(n => n.id === id);
  if (!node) { console.warn('⚠️  Nodo non trovato:', id); return; }
  node.func = func;
  console.log(`✅  ${id} (${node.name})`);
}

function removeNodes(ids) {
  const before = flows.length;
  flows = flows.filter(n => !ids.includes(n.id));
  console.log(`🗑️   Rimossi ${before - flows.length} nodi vecchi`);
}

// Broker da usare: quello che si connette a mosquitto:1883 (Docker interno)
// Di default usiamo 36e1a1ae638c672b "Mosquitto (localhost:1883)" che è già connesso
const BROKER_ID = '36e1a1ae638c672b';

// Tab di destinazione per i nodi di controllo bidirezionale
const BIDIRECTIONAL_TAB_ID = 'tab-bidir-ctrl';

// ── 1. NODO MQTT-IN per ascoltare eventi Ditto ────────────────────────────────
// Rimuoviamo eventuali nodi vecchi
removeNodes(['mqtt-in-ditto-events', 'func-parse-ditto-event', 'debug-ditto-event', BIDIRECTIONAL_TAB_ID]);

// Aggiungi il tab
flows.push({
  id: BIDIRECTIONAL_TAB_ID,
  type: 'tab',
  label: '⟳ Bidirectional Control',
  disabled: false,
  info: ''
});

// Nodo MQTT-In
flows.push({
  id: 'mqtt-in-ditto-events',
  type: 'mqtt in',
  z: BIDIRECTIONAL_TAB_ID,
  name: 'Ditto Events',
  topic: 'smartpark/events/#',
  qos: '0',
  datatype: 'json',
  broker: BROKER_ID,
  nl: false, rap: true, rh: 0, inputs: 0,
  x: 150, y: 80,
  wires: [['func-parse-ditto-event']]
});

// Nodo Function che salva lo stato
flows.push({
  id: 'func-parse-ditto-event',
  type: 'function',
  z: BIDIRECTIONAL_TAB_ID,
  name: 'Store desired state',
  func: `// Ricevi evento da Ditto, estrai thingId e il valore desiderato
var body = msg.payload;
if (!body) return null;

// Formato evento Ditto: { thingId, path, data, success, status }
var thingId = body.thingId || '';
if (!thingId) return null;

var parts = thingId.split(':');
var deviceId = parts[parts.length - 1];
if (!deviceId) return null;

// Leggi lo stato corrente
var currentState = global.get('state_' + deviceId) || {};

// Il path indica la chiave modificata, es. /features/sensors/desiredProperties/alert_active
var dittoPath = body.path || '';
var value = body.data;

if (dittoPath.includes('desiredProperties/')) {
  // Modifica di una singola proprietà
  var key = dittoPath.split('desiredProperties/').pop().split('/')[0];
  if (key) currentState[key] = value;
} else if (dittoPath.includes('desiredProperties')) {
  // Modifica dell'intero oggetto desiredProperties
  if (value && typeof value === 'object') {
    Object.assign(currentState, value);
  }
} else if (dittoPath === '/' && value && value.features) {
  // Evento merge completo del twin (da telemetria): aggiorna solo se il twin
  // ha desiredProperties salvate che differiscono dallo stato corrente
  var dp = value.features && value.features.sensors && value.features.sensors.desiredProperties;
  if (dp && typeof dp === 'object') {
    // Merge parziale: prevale lo stato già in memoria (comandi UI non ancora confermati)
    Object.keys(dp).forEach(function(k) {
      if (currentState[k] === undefined) currentState[k] = dp[k];
    });
  }
} else {
  // Fallback: se data è un oggetto, mergialo
  if (value && typeof value === 'object') {
    Object.assign(currentState, value);
  }
}

global.set('state_' + deviceId, currentState);
node.status({fill: 'green', shape: 'dot', text: deviceId + ' updated'});
return msg;`,
  outputs: 1,
  noerr: 0, initialize: '', finalize: '', libs: [],
  x: 370, y: 80,
  wires: [['debug-ditto-event']]
});

flows.push({
  id: 'debug-ditto-event',
  type: 'debug',
  z: BIDIRECTIONAL_TAB_ID,
  name: 'Debug Ditto cmd',
  active: true, tosidebar: true, console: false, tostatus: false,
  complete: 'payload', targetType: 'msg',
  x: 590, y: 80,
  wires: []
});

console.log('✅  Nodi bidirezionali aggiunti');

// ── 2. HELPER PER LEGGERE STATO DA GLOBAL ────────────────────────────────────
// Questo snippet viene preposto a ogni nodo generatore
const STATE_HEADER = (deviceIdExpr) => `// ── Stato bidirezionale ────────────────────────────────────────
var _deviceId = ${deviceIdExpr};
var _state = global.get('state_' + _deviceId) || {};
var _globalAlert = global.get('alert_active') || false;
var alertActive = _state.alert_active !== undefined ? _state.alert_active : _globalAlert;
`;

// ── 3. NODO ENV (b228e13634317520) ───────────────────────────────────────────
setNode('b228e13634317520', `// --- PERIMETRO ---
const reservePerimeter = [
  [39.3239168,16.466235],[39.3234522,16.466466],[39.3235048,16.4676417],
  [39.323559,16.4681864],[39.3236335,16.4690445],[39.3236708,16.4691654],
  [39.3237774,16.4691252],[39.3238709,16.4690944],[39.3240964,16.4690636],
  [39.3243952,16.4691885],[39.3244585,16.4689148],[39.3243182,16.4688331],
  [39.3243402,16.4686838],[39.3249506,16.4686518],[39.3250166,16.4683106],
  [39.3261823,16.4675287],[39.3263583,16.4672017],[39.3258634,16.4664198],
  [39.3239168,16.466235]
];
function rnd(min,max,dec){return parseFloat((Math.random()*(max-min)+min).toFixed(dec||2));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
var minLat=Math.min(...reservePerimeter.map(p=>p[0]));
var maxLat=Math.max(...reservePerimeter.map(p=>p[0]));
var minLng=Math.min(...reservePerimeter.map(p=>p[1]));
var maxLng=Math.max(...reservePerimeter.map(p=>p[1]));
function isInside(lat,lng,poly){
  var inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    if(((poly[i][1]>lng)!==(poly[j][1]>lng))&&(lat<(poly[j][0]-poly[i][0])*(lng-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0]))inside=!inside;
  }
  return inside;
}
function genPoint(){var lat,lng;do{lat=Math.random()*(maxLat-minLat)+minLat;lng=Math.random()*(maxLng-minLng)+minLng;}while(!isInside(lat,lng,reservePerimeter));return{lat:parseFloat(lat.toFixed(6)),lng:parseFloat(lng.toFixed(6))};}
// Sensori persistenti
var sensors=context.get('sensors');
if(!sensors){sensors=[];for(var i=11;i<15;i++){var pt=genPoint();sensors.push({device_id:'env-'+(100+i),lat:pt.lat,lng:pt.lng});}context.set('sensors',sensors);}
var sensor=sensors[msg.sensorIndex!==undefined?msg.sensorIndex:Math.floor(Math.random()*sensors.length)];

// ── Stato bidirezionale ──────────────────────────────────────────
var _state = global.get('state_' + sensor.device_id) || {};
var _globalAlert = global.get('alert_active') || false;
var alertActive = _state.alert_active !== undefined ? _state.alert_active : _globalAlert;
var samplingRate = _state.sampling_rate_s || 15;
var alertThresholdTemp = _state.alert_threshold_temp || 50;

var baseTemp = alertActive ? rnd(55,75,1) : rnd(15,35,1);

msg.payload = {
  device_id: sensor.device_id,
  type: 'environmental',
  features: {
    sensors: {
      desiredProperties: {
        alert_active: alertActive,
        sampling_rate_s: samplingRate,
        alert_threshold_temp: alertThresholdTemp
      },
      properties: {
        temperature: baseTemp,
        humidity: alertActive ? rnd(10,30,1) : rnd(30,90,1),
        pressure: rnd(98000,103000,1),
        light: alertActive ? rnd(200,500,0) : Math.floor(rnd(0,100,0)),
        noise: alertActive ? rnd(70,95,1) : rnd(30,55,1),
        weather_prediction: alertActive ? 'Fire-Risk' : pick(['Sun-Drenched','Cloudy','Rainy']),
        prediction_confidence: rnd(0.4,0.99,2),
        anomaly_detected: alertActive || baseTemp > alertThresholdTemp,
        anomaly_score: alertActive ? rnd(0.85,1.0,2) : 0.0
      }
    },
    motion: {
      properties: {
        tof: Math.floor(rnd(80,600,0)),
        angle: rnd(-15,15,1),
        accX: rnd(-20,20,3),
        accY: rnd(-20,20,3),
        accZ: rnd(950,1050,3),
        vibrAccX: rnd(-0.05,0.05,5),
        vibrAccY: rnd(-0.05,0.05,5),
        vibrAccZ: rnd(0,0.08,5)
      }
    },
    gateway: {
      properties: {
        EG5120_CPU_Temperature: Math.floor(alertActive ? rnd(60,80,0) : rnd(35,55,0)),
        EG5120_CPU_status: alertActive ? 'HIGH' : 'NORMAL',
        EG5120_Storage_total: '13G',
        EG5120_Storage_free: pick(['6.8G','7.1G','5.9G','6.2G']),
        EG5120_RAM_total_mb: 1907,
        EG5120_RAM_free_mb: Math.floor(alertActive ? rnd(200,400,0) : rnd(500,800,0))
      }
    }
  },
  attributes: { lat: sensor.lat, lng: sensor.lng, GPS_status: 'Stationary' },
  timestamp: new Date().toISOString()
};
msg.topic = 'smartpark/telemetry/' + sensor.device_id;
return msg;`);

// ── 4. NODO VISION (165f73e6a3c8867e) ────────────────────────────────────────
setNode('165f73e6a3c8867e', `// --- PERIMETRO ---
const reservePerimeter = [
  [39.3239168,16.466235],[39.3234522,16.466466],[39.3235048,16.4676417],
  [39.323559,16.4681864],[39.3236335,16.4690445],[39.3236708,16.4691654],
  [39.3237774,16.4691252],[39.3238709,16.4690944],[39.3240964,16.4690636],
  [39.3243952,16.4691885],[39.3244585,16.4689148],[39.3243182,16.4688331],
  [39.3243402,16.4686838],[39.3249506,16.4686518],[39.3250166,16.4683106],
  [39.3261823,16.4675287],[39.3263583,16.4672017],[39.3258634,16.4664198],
  [39.3239168,16.466235]
];
function rnd(min,max,dec){return parseFloat((Math.random()*(max-min)+min).toFixed(dec||2));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
var minLat=Math.min(...reservePerimeter.map(p=>p[0]));
var maxLat=Math.max(...reservePerimeter.map(p=>p[0]));
var minLng=Math.min(...reservePerimeter.map(p=>p[1]));
var maxLng=Math.max(...reservePerimeter.map(p=>p[1]));
function isInside(lat,lng,poly){
  var inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    if(((poly[i][1]>lng)!==(poly[j][1]>lng))&&(lat<(poly[j][0]-poly[i][0])*(lng-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0]))inside=!inside;
  }
  return inside;
}
function genPoint(){var lat,lng;do{lat=Math.random()*(maxLat-minLat)+minLat;lng=Math.random()*(maxLng-minLng)+minLng;}while(!isInside(lat,lng,reservePerimeter));return{lat:parseFloat(lat.toFixed(6)),lng:parseFloat(lng.toFixed(6))};}
// Sensori persistenti
var sensors=context.get('vision_sensors');
if(!sensors){sensors=[];for(var i=0;i<7;i++){var pt=genPoint();sensors.push({device_id:'cam-'+(200+i),lat:pt.lat,lng:pt.lng});}context.set('vision_sensors',sensors);}
var sensor=sensors[msg.sensorIndex!==undefined?msg.sensorIndex:Math.floor(Math.random()*sensors.length)];

// ── Stato bidirezionale ──────────────────────────────────────────
var _state = global.get('state_' + sensor.device_id) || {};
var _globalAlert = global.get('alert_active') || false;
var alertActive = _state.alert_active !== undefined ? _state.alert_active : _globalAlert;
var trackingMode = _state.tracking_mode || 'person';
var confidenceThreshold = _state.confidence_threshold || 0.8;
var nightMode = _state.night_mode !== undefined ? _state.night_mode : false;
var frameRate = _state.frame_rate_fps || 15;

var personCount = alertActive ? Math.floor(rnd(8,20,0)) : Math.floor(rnd(0,20,0));
var density = personCount===0?'empty':personCount<5?'low':personCount<12?'medium':'high';
var anomaly = alertActive || Math.random()<0.1;

msg.payload = {
  device_id: sensor.device_id,
  type: 'vision',
  features: {
    sensors: {
      desiredProperties: {
        alert_active: alertActive,
        tracking_mode: trackingMode,
        confidence_threshold: confidenceThreshold,
        night_mode: nightMode,
        frame_rate_fps: frameRate
      },
      properties: {
        person_count: personCount,
        crowd_density: density,
        activity: alertActive ? 'running' : pick(['walking','standing','gathering']),
        confidence: rnd(0.7,0.99,2),
        objects_detected: Math.floor(rnd(0,10,0)),
        anomaly_detected: anomaly,
        anomaly_score: anomaly ? rnd(0.7,1.0,2) : 0.0,
        dominant_emotion: alertActive ? 'fear' : pick(['neutral','happy','curious'])
      }
    }
  },
  attributes: { lat: sensor.lat, lng: sensor.lng },
  timestamp: new Date().toISOString()
};
msg.topic = 'smartpark/telemetry/' + sensor.device_id;
return msg;`);

// ── 5. NODO AUDIO (1e04b10131442395) ─────────────────────────────────────────
setNode('1e04b10131442395', `// --- PERIMETRO ---
const reservePerimeter = [
  [39.3239168,16.466235],[39.3234522,16.466466],[39.3235048,16.4676417],
  [39.323559,16.4681864],[39.3236335,16.4690445],[39.3236708,16.4691654],
  [39.3237774,16.4691252],[39.3238709,16.4690944],[39.3240964,16.4690636],
  [39.3243952,16.4691885],[39.3244585,16.4689148],[39.3243182,16.4688331],
  [39.3243402,16.4686838],[39.3249506,16.4686518],[39.3250166,16.4683106],
  [39.3261823,16.4675287],[39.3263583,16.4672017],[39.3258634,16.4664198],
  [39.3239168,16.466235]
];
function rnd(min,max,dec){return parseFloat((Math.random()*(max-min)+min).toFixed(dec||2));}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
var minLat=Math.min(...reservePerimeter.map(p=>p[0]));
var maxLat=Math.max(...reservePerimeter.map(p=>p[0]));
var minLng=Math.min(...reservePerimeter.map(p=>p[1]));
var maxLng=Math.max(...reservePerimeter.map(p=>p[1]));
function isInside(lat,lng,poly){
  var inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    if(((poly[i][1]>lng)!==(poly[j][1]>lng))&&(lat<(poly[j][0]-poly[i][0])*(lng-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0]))inside=!inside;
  }
  return inside;
}
function genPoint(){var lat,lng;do{lat=Math.random()*(maxLat-minLat)+minLat;lng=Math.random()*(maxLng-minLng)+minLng;}while(!isInside(lat,lng,reservePerimeter));return{lat:parseFloat(lat.toFixed(6)),lng:parseFloat(lng.toFixed(6))};}
// Sensori persistenti
var sensors=context.get('audio_sensors');
if(!sensors){sensors=[];for(var i=0;i<20;i++){var pt=genPoint();sensors.push({device_id:'mic-'+(300+i),lat:pt.lat,lng:pt.lng});}context.set('audio_sensors',sensors);}
var sensor=sensors[msg.sensorIndex!==undefined?msg.sensorIndex:Math.floor(Math.random()*sensors.length)];

// ── Stato bidirezionale ──────────────────────────────────────────
var _state = global.get('state_' + sensor.device_id) || {};
var _globalAlert = global.get('alert_active') || false;
var alertActive = _state.alert_active !== undefined ? _state.alert_active : _globalAlert;
var sensitivity = _state.sensitivity || 0.8;
var noiseThreshold = _state.noise_threshold_db || 85;

var speechDetected = Math.random()<0.7;
var sentiment = alertActive ? 'negative' : (speechDetected ? pick(['positive','neutral','negative']) : 'neutral');
var sentimentScore = sentiment==='positive' ? rnd(0.5,1.0,2) : sentiment==='negative' ? rnd(-1.0,-0.5,2) : rnd(-0.2,0.2,2);
var panicTr = ['Andate via!','Al fuoco!','Evacuate!','Aiuto!','Uscite!'];
var normalTr = ['tutto bene','che bella giornata','andiamo avanti','meraviglioso posto'];
var transcript = alertActive ? pick(panicTr) : (speechDetected ? pick(normalTr) : '');

msg.payload = {
  device_id: sensor.device_id,
  type: 'sentimentAnalysis',
  features: {
    sensors: {
      desiredProperties: {
        alert_active: alertActive,
        sensitivity: sensitivity,
        noise_threshold_db: noiseThreshold
      },
      properties: {
        sentiment: sentiment,
        sentiment_score: sentimentScore,
        speech_detected: speechDetected || alertActive,
        noise_db: alertActive ? rnd(75,92,1) : (speechDetected ? rnd(55,82,1) : rnd(28,48,1)),
        language: (speechDetected || alertActive) ? pick(['it','en','fr']) : '',
        transcript: transcript,
        location: 'reserve-area'
      }
    }
  },
  attributes: { lat: sensor.lat, lng: sensor.lng },
  timestamp: new Date().toISOString()
};
msg.topic = 'smartpark/telemetry/' + sensor.device_id;
return msg;`);

// ── 6. NODI SHIMMER ───────────────────────────────────────────────────────────
const shimmerConfigs = [
  {
    id: '9c8ba7977acff3e1',
    deviceId: 'shimmer-visitor-02',
    path: [[39.3240,16.4667],[39.3238,16.4672],[39.3238,16.4679],[39.3238,16.4686],[39.3240,16.4689],[39.3242,16.4688],[39.3244,16.4686],[39.3244,16.4680],[39.3243,16.4673],[39.3241,16.4668]]
  },
  {
    id: '2b8255a5967ec073',
    deviceId: 'shimmer-visitor-04',
    path: [[39.3243,16.4672],[39.3245,16.4678],[39.3247,16.4684],[39.3249,16.4688],[39.3251,16.4685],[39.3252,16.4679],[39.3250,16.4673],[39.3248,16.4669],[39.3245,16.4668],[39.3243,16.4672]]
  },
  {
    id: '7201d3ae7605dd1f',
    deviceId: 'shimmer-visitor-05',
    // Circular path
    path: null,
    circular: true,
    centerLat: 39.3252,
    centerLng: 16.4681,
    radius: 0.0005
  }
];

shimmerConfigs.forEach(cfg => {
  let motionCode;
  if (cfg.circular) {
    motionCode = `
var state = context.get('pathState') || { angle: Math.random() * Math.PI * 2 };
state.angle += alertActive ? 0.18 : 0.06;
if (state.angle > Math.PI * 2) state.angle -= Math.PI * 2;
context.set('pathState', state);
var lat = ${cfg.centerLat} + ${cfg.radius} * Math.cos(state.angle);
var lng = ${cfg.centerLng} + ${cfg.radius} * Math.sin(state.angle);`;
  } else {
    const pathStr = JSON.stringify(cfg.path);
    motionCode = `
var walkPath = ${pathStr};
var state = context.get('pathState') || { segment: 0, t: 0, direction: 1 };
var speed = alertActive ? 0.15 : 0.03;
var p1 = walkPath[state.segment];
var p2 = walkPath[state.segment+1] || walkPath[0];
var lat = p1[0] + (p2[0]-p1[0]) * state.t;
var lng = p1[1] + (p2[1]-p1[1]) * state.t;
state.t += speed;
if (state.t >= 1) {
  state.t = 0;
  state.segment += state.direction;
  if (state.segment >= walkPath.length-1) { state.direction=-1; state.segment=walkPath.length-2; }
  if (state.segment < 0) { state.direction=1; state.segment=0; }
}
context.set('pathState', state);`;
  }

  setNode(cfg.id, `// ── Stato bidirezionale ──────────────────────────────────────────
var _state = global.get('state_${cfg.deviceId}') || {};
var _globalAlert = global.get('alert_active') || false;
var alertActive = _state.alert_active !== undefined ? _state.alert_active : _globalAlert;
var samplingHz = _state.sampling_rate_hz || 10;
var vibAlertEnabled = _state.vibration_alert_enabled !== undefined ? _state.vibration_alert_enabled : true;
var vibThreshold = _state.vibration_threshold || 2.5;

// ── Movimento ──────────────────────────────────────────────────────
${motionCode}

// ── Attività ──────────────────────────────────────────────────────
var act = alertActive ? 'running' : (['walking','walking','hiking','standing'][Math.floor(Math.random()*4)]);
var steps = context.get('steps') || 0;
if (act !== 'standing') steps += Math.floor(Math.random() * (alertActive ? 12 : 4));
context.set('steps', steps);
var hrBase = alertActive ? 130 : (act==='walking'?90:act==='hiking'?110:70);
var hr = Math.floor(hrBase + Math.random()*8);

msg.payload = {
  device_id: '${cfg.deviceId}',
  type: 'activityRecognition',
  features: {
    sensors: {
      desiredProperties: {
        alert_active: alertActive,
        sampling_rate_hz: samplingHz,
        vibration_alert_enabled: vibAlertEnabled,
        vibration_threshold: vibThreshold
      },
      properties: {
        heart_rate_bpm: hr,
        gsr_kohm: parseFloat((alertActive ? 60+Math.random()*30 : 10+Math.random()*50).toFixed(1)),
        activity_label: act,
        steps_total: steps
      }
    },
    motion: {
      properties: {
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6))
      }
    }
  },
  timestamp: new Date().toISOString()
};
msg.topic = 'smartpark/telemetry/${cfg.deviceId}';
return msg;`);
});

// ── SALVA ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(FLOWS_PATH, JSON.stringify(flows, null, 2), 'utf8');
console.log('\n🎉  flows.json aggiornato! Tutti i nodi usano features + bidirezionalità.');
console.log('👉  Riavvia Node-RED: docker restart smart_park_project-nodered-1');
