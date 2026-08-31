/**
 * Simple HTTP server for CryptoPulse frontend
 * Serves static files from the frontend directory
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PORT = process.env.FRONTEND_PORT || 3000;
const FRONTEND_DIR = __dirname;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:4000/ws/prices';

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Log request
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  // Get file path
  let filePath = path.join(FRONTEND_DIR, req.url === '/' ? 'index.html' : req.url);

  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found - return 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Get file extension and MIME type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      // Inject config into HTML files
      if (ext === '.html') {
        const configScript = `
    <script>
      window.CRYPTOPULSE_CONFIG = {
        API_BASE_URL: '${API_BASE_URL}',
        WEBSOCKET_URL: '${WEBSOCKET_URL}'
      };
    </script>`;
        content = content.toString().replace('</head>', `${configScript}\n  </head>`);
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   CryptoPulse Frontend Server          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${FRONTEND_DIR}`);
  console.log(`🔌 Backend API: http://localhost:4000/api`);
  console.log(`🔗 WebSocket: ws://localhost:4000/ws/prices`);
  console.log('\n🚀 Open http://localhost:3000 in your browser\n');
});

// Handle errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('Try a different port: FRONTEND_PORT=3001 node server.js');
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down frontend server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
