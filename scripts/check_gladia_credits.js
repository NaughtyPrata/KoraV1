const https = require('https');

const API_KEY = '42f4192e-55d4-4a27-830a-d62c2cb32c03';

const options = {
  hostname: 'api.gladia.io',
  port: 443,
  path: '/v2/account',
  method: 'GET',
  headers: {
    'X-Gladia-Key': API_KEY,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
