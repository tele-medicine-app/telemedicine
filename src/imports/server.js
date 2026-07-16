// ============================================================
// Telemedicine Sync — Signaling Backend
// ------------------------------------------------------------
// A self-contained PeerJS + Express server that:
//   1. Hosts the WebRTC signaling channel at  /peerjs
//   2. Serves the front-end (index.html / app.js / styles.css)
//   3. Exposes a tiny health endpoint for free hosting providers
//
// Designed to deploy with zero config to any Node-capable free
// host (Render, Railway, Fly.io, Koyeb, Cyclic...). It only
// needs a single PORT env var, which every provider injects.
// ============================================================

const express = require('express');
const http = require('http');
const path = require('path');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

// ---- Configuration ----------------------------------------
const PORT = process.env.PORT || 3000;

// Restrict allowed peer IDs to the two roles the app uses.
// Keeps the signaling namespace tidy and predictable.
const ALLOWED_IDS = new Set(['host', 'client']);

// ---- Static front-end -------------------------------------
// Serve the PWA shell from the project root.
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    // Never cache the HTML entry or service worker — users always
    // get the latest session logic, while assets stay cache-friendly.
    if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ---- Health & landing probes ------------------------------
// Used by hosting platforms to know the container is alive.
// /health and /status are for probes; '/' falls through to index.html
// because of express.static above, but we keep a plain-text reporter
// for platforms that ping the root with Accept: text/plain.
app.get(['/health', '/status'], (req, res) => {
  res.type('text/plain').send('Telemedicine Sync signaling hub is online\n');
});

// ---- PeerJS signaling engine ------------------------------
// ExpressPeerServer wraps OUR http server and returns an Express
// sub-app. The mount point ('/peerjs') IS the public path — do NOT
// also pass a `path` option, which collides with Express routing and
// breaks the handshake. The client's `new Peer(id, { path: '/peerjs' })`
// constructor talks to this mount to exchange offers / answers / ICE.
const peerApp = ExpressPeerServer(server, {
  allow_discovery: false,        // don't enumerate peers publicly
  cleanup_out_msgs: true,        // drop messages destined for dead sockets
  concurrently_limit: 8,         // cap concurrent handshakes per socket
  proxied: true,                 // trust X-Forwarded-* headers from HTTPS load balancers
});

app.use('/peerjs', peerApp);

// ---- Signaling lifecycle hooks ----------------------------
// Gatekeep which IDs may register, so random clients can't squat
// arbitrary namespaces on a public instance.
peerApp.on('connection', (client) => {
  const id = client.getId();
  if (!ALLOWED_IDS.has(id)) {
    // Reject anything that isn't one of our two app roles.
    try { const s = client.getSocket && client.getSocket(); s && s.close(); } catch (_) { /* noop */ }
    console.warn(`[peerjs] rejected unauthorized id: ${id}`);
    return;
  }
  console.log(`[peerjs] registered: ${id}`);
});

peerApp.on('disconnect', (client) => {
  const id = client && client.getId ? client.getId() : '?';
  console.log(`[peerjs] disconnected: ${id}`);
});

peerApp.on('error', (err) => {
  // Keep the process alive across transient signaling errors.
  console.error('[peerjs]', err && err.message ? err.message : err);
});

// ---- Fall-through 404 ------------------------------------
// Anything that isn't a static file, health, or /peerjs route.
app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// ---- Boot -------------------------------------------------
server.listen(PORT, () => {
  console.log(`Telemedicine Sync signaling hub listening on :${PORT}`);
});

// ---- Graceful shutdown ------------------------------------
function shutdown(signal) {
  console.log(`\n${signal} received — closing server...`);
  server.close(() => process.exit(0));
  // Force-exit if something hangs.
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
