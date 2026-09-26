import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/superbase_Access_Tokens\s*=\s*(.+)/);
let token = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, '') : null;
const projectRef = 'jqptprskuxkhfoxsvwcl';

const sql = fs.readFileSync('supabase/migrations/20260926000000_build_1a_financial_foundation.sql', 'utf8');

console.log('Sending migration query to Supabase Management API...');

const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Migration executed successfully!');
      console.log('Response:', data.slice(0, 500));
    } else {
      console.error('Migration failed:');
      console.error(data);
    }
  });
});

req.on('error', err => {
  console.error('Request error:', err);
});

req.write(JSON.stringify({ query: sql }));
req.end();
