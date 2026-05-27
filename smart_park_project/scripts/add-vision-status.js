const fs = require('fs');
const path = require('path');

const FLOWS_PATH = path.join(__dirname, '..', 'nodered_data', 'flows.json');
let flows = JSON.parse(fs.readFileSync(FLOWS_PATH, 'utf8'));

const n = flows.find(n => n.id === '165f73e6a3c8867e');
if (!n) { console.error('Nodo 165f73e6a3c8867e non trovato'); process.exit(1); }

// Aggiungiamo il status dot PRIMA del return finale, per ogni sensore del ciclo
// Il nodo itera su un singolo sensore per invocazione, quindi il status è per quel sensore
const statusCode = `
// ── Status dot visivo nel nodo ─────────────────────────────────────────────
var modeIcons = {
  person: '👥 persone',
  crowd: '🏟 folla',
  anomaly: '🔴 anomalie',
  disabled: '⛔ disab.'
};
var statusText = (alertActive ? '🚨 ' : '') +
  (nightMode ? '🌙 ' : '') +
  (modeIcons[trackingMode] || trackingMode) +
  ' @' + sensor.device_id;
node.status({
  fill: alertActive ? 'red' : (nightMode ? 'blue' : 'green'),
  shape: 'dot',
  text: statusText
});
`;

// Inserisci prima di "msg.topic = ..."
n.func = n.func.replace(
  "msg.topic = 'smartpark/telemetry/' + sensor.device_id;",
  statusCode + "\nmsg.topic = 'smartpark/telemetry/' + sensor.device_id;"
);

fs.writeFileSync(FLOWS_PATH, JSON.stringify(flows, null, 2), 'utf8');
console.log('✅ Feedback visivo aggiunto al nodo Vision (165f73e6a3c8867e)');
