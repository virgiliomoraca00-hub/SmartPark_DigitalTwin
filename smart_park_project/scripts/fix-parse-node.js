const fs = require('fs');
const flows = JSON.parse(fs.readFileSync('nodered_data/flows.json', 'utf8'));
const n = flows.find(n => n.id === 'func-parse-ditto-event');
if (!n) { console.log('NOT FOUND'); process.exit(1); }

n.func = [
  '// Riceve SOLO eventi desiredProperties (filtrati dall\'outgoingScript Ditto)',
  'var body = msg.payload;',
  'if (!body || !body.thingId || !body.path) return null;',
  '',
  'var deviceId = body.thingId.split(\':\').pop();',
  'if (!deviceId) return null;',
  '',
  'var currentState = global.get(\'state_\' + deviceId) || {};',
  'var dittoPath = body.path;  // es: /features/sensors/desiredProperties/alert_active',
  'var value = body.data;',
  '',
  '// Estrai il nome del campo dalla fine del path',
  'var dpMatch = dittoPath.match(/desiredProperties\\/(.+)$/);',
  'if (dpMatch) {',
  '  // Modifica di un singolo campo',
  '  var key = dpMatch[1];',
  '  currentState[key] = value;',
  '} else if (dittoPath.includes(\'desiredProperties\') && value && typeof value === \'object\') {',
  '  // Modifica dell\'intero blocco desiredProperties',
  '  Object.assign(currentState, value);',
  '} else {',
  '  return null;',
  '}',
  '',
  'global.set(\'state_\' + deviceId, currentState);',
  'var lastKey = dittoPath.split(\'/\').pop();',
  'node.status({ fill: \'blue\', shape: \'dot\', text: deviceId + \' > \' + lastKey + \' = \' + JSON.stringify(value) });',
  'return msg;'
].join('\n');

fs.writeFileSync('nodered_data/flows.json', JSON.stringify(flows, null, 2), 'utf8');
console.log('✅ func-parse-ditto-event aggiornato');
