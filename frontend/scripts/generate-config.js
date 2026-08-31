/**
 * Generates frontend/config.js at build time (Vercel) from env vars.
 * Mirrors the window.CRYPTOPULSE_CONFIG object that server.js injects at
 * request time for local dev, but as a static file for static hosting.
 */

const fs = require('fs');
const path = require('path');

const { API_BASE_URL, WEBSOCKET_URL } = process.env;

if (!API_BASE_URL || !WEBSOCKET_URL) {
  console.error('generate-config: missing API_BASE_URL and/or WEBSOCKET_URL env vars');
  process.exit(1);
}

const outPath = path.join(__dirname, '..', 'config.js');
const contents = `window.CRYPTOPULSE_CONFIG = ${JSON.stringify({ API_BASE_URL, WEBSOCKET_URL }, null, 2)};\n`;

fs.writeFileSync(outPath, contents);
console.log(`Wrote ${outPath}`);
