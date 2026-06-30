const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const secret = crypto.randomBytes(32).toString('hex');

console.log('Generated SOCKET_SECRET:', secret);

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  if (env.includes('SOCKET_SECRET=')) {
    console.log('.env.local already contains SOCKET_SECRET; skipping write.');
  } else {
    fs.appendFileSync(envPath, `\nSOCKET_SECRET=${secret}\n`);
    console.log('Appended SOCKET_SECRET to .env.local');
  }
} else {
  fs.writeFileSync(envPath, `SOCKET_SECRET=${secret}\n`);
  console.log('Created .env.local with SOCKET_SECRET');
}

console.log('Done. Use the same secret for server and Next.js API (set NEXT_PUBLIC_SOCKET_URL if needed).');
