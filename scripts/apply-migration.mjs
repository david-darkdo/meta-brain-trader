import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/superbase_Access_Tokens\s*=\s*(.+)/);
let token = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, '') : null;
const projectRef = 'jqptprskuxkhfoxsvwcl';

const migrationFile = process.argv[2] || 'supabase/migrations/20260927000000_build_1a_hardening.sql';
console.log(`Applying migration file: ${migrationFile}`);

const sql = fs.readFileSync(migrationFile, 'utf8');

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
      process.exit(1);
    }
  });
});

req.on('error', err => {
  console.error('Request error:', err);
  process.exit(1);
});

req.write(JSON.stringify({ query: sql }));
req.end();
