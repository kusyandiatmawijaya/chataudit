const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend', 'dist');
const dest = path.join(__dirname, '..', 'dist');

if (fs.existsSync(src)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log('[copy-dist] Successfully copied frontend/dist to ./dist for Vercel deployment.');
} else {
  console.error('[copy-dist] frontend/dist does not exist!');
  process.exit(1);
}
