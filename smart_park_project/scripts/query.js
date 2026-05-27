const http = require('http');
const req = http.request('http://localhost:8086/api/v2/query?org=smart-park', {
  method: 'POST',
  headers: {
    'Authorization': 'Token smart-park-token-12345',
    'Accept': 'application/csv',
    'Content-Type': 'application/vnd.flux'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
req.write('from(bucket:"sensor-data") |> range(start: -1m) |> limit(n:2)');
req.end();
