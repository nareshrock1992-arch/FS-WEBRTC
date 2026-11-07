#!/usr/bin/env node
/**
 * FS-WebRTC lab server (Option A from M0_DESIGN_IMPACT_ASSESSMENT.md)
 *
 *  1. Serves the built softphone (dist/) over HTTPS with strict security headers.
 *  2. Proxies the same-origin secure WebSocket  wss://<host>:<port>/sip  to FreeSWITCH's
 *     existing plain WebSocket listener (default ws://192.168.1.133:5066) on the SAME machine,
 *     so the unencrypted hop never leaves the server and no FreeSWITCH setting or certificate
 *     has to change.
 *
 * Node.js built-ins only (no runtime dependencies). Configuration via environment variables:
 *   FSW_BIND               address to listen on              (default 127.0.0.1)
 *   FSW_PORT               HTTPS port                        (default 8443)
 *   FSW_TLS_CERT           path to certificate PEM           (required)
 *   FSW_TLS_KEY            path to private key PEM           (required)
 *   FSW_STATIC_DIR         built app directory               (default ../dist)
 *   FSW_SIP_WS_UPSTREAM    FreeSWITCH WS URL                 (default ws://192.168.1.133:5066)
 *   FSW_MAX_WS             max concurrent WS connections     (default 50)
 */
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:https';
import { connect } from 'node:net';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = {
  bind: process.env.FSW_BIND || '127.0.0.1',
  port: Number(process.env.FSW_PORT || 8443),
  cert: process.env.FSW_TLS_CERT,
  key: process.env.FSW_TLS_KEY,
  staticDir: resolve(process.env.FSW_STATIC_DIR || join(here, '..', 'dist')),
  upstream: new URL(process.env.FSW_SIP_WS_UPSTREAM || 'ws://192.168.1.133:5066'),
  maxWs: Number(process.env.FSW_MAX_WS || 50),
};

if (!cfg.cert || !cfg.key) {
  console.error('FSW_TLS_CERT and FSW_TLS_KEY must be set (no plain-HTTP mode exists).');
  process.exit(1);
}
if (cfg.upstream.protocol !== 'ws:') {
  console.error('FSW_SIP_WS_UPSTREAM must be a ws:// URL on this host.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; " +
    "frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const ts = () => new Date().toISOString();
const logLine = (msg) => console.log(`${ts()} ${msg}`);

// ------------------------------------------------------------------ static files

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY_HEADERS }).end();
    return;
  }
  const url = new URL(req.url || '/', 'https://local');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS }).end('ok\n');
    return;
  }
  let rel;
  try {
    rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  } catch {
    res.writeHead(400, SECURITY_HEADERS).end();
    return;
  }
  let file = resolve(cfg.staticDir, rel || 'index.html');
  // Path-traversal guard: must stay inside staticDir.
  if (file !== cfg.staticDir && !file.startsWith(cfg.staticDir + sep)) {
    res.writeHead(403, SECURITY_HEADERS).end();
    return;
  }
  let stat;
  try {
    stat = statSync(file);
    if (stat.isDirectory()) throw new Error('dir');
  } catch {
    file = join(cfg.staticDir, 'index.html'); // single-page app fallback
    try {
      stat = statSync(file);
    } catch {
      res.writeHead(500, SECURITY_HEADERS).end('Build not found. Run npm run build.\n');
      return;
    }
  }
  const isAsset = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-store',
    ...SECURITY_HEADERS,
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}

// ------------------------------------------------------------------ WSS -> WS proxy

let wsCount = 0;

function reject(socket, status, text) {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

function proxyWebSocket(req, clientSocket, head) {
  const url = new URL(req.url || '/', 'https://local');
  const peer = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
  if (url.pathname !== '/sip') return reject(clientSocket, 404, 'Not Found');

  // Only the "sip" sub-protocol (RFC 7118) is relayed.
  const protocols = String(req.headers['sec-websocket-protocol'] || '')
    .split(',')
    .map((p) => p.trim().toLowerCase());
  if (!protocols.includes('sip')) return reject(clientSocket, 400, 'Bad Request');

  // Cross-site WebSocket hijacking protection: Origin must be this very site.
  const origin = req.headers.origin;
  if (origin && origin !== `https://${req.headers.host}`) {
    logLine(`WS reject origin=${origin} peer=${peer}`);
    return reject(clientSocket, 403, 'Forbidden');
  }
  if (wsCount >= cfg.maxWs) return reject(clientSocket, 503, 'Service Unavailable');

  const upstream = connect(Number(cfg.upstream.port || 80), cfg.upstream.hostname);
  wsCount += 1;
  logLine(`WS open peer=${peer} -> ${cfg.upstream.host} (active ${wsCount})`);

  const forward = [
    'upgrade',
    'connection',
    'sec-websocket-key',
    'sec-websocket-version',
    'sec-websocket-protocol',
  ];
  upstream.on('connect', () => {
    const lines = [`GET ${cfg.upstream.pathname || '/'} HTTP/1.1`, `Host: ${cfg.upstream.host}`];
    for (const name of forward) {
      const value = req.headers[name];
      if (value) lines.push(`${name}: ${value}`);
    }
    lines.push(`X-Forwarded-For: ${req.socket.remoteAddress}`);
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });

  let closed = false;
  const close = (why) => {
    if (closed) return;
    closed = true;
    wsCount -= 1;
    logLine(`WS close peer=${peer} (${why}) (active ${wsCount})`);
    upstream.destroy();
    clientSocket.destroy();
  };
  upstream.on('error', (e) => {
    if (!clientSocket.writableEnded && upstream.bytesRead === 0) {
      reject(clientSocket, 502, 'Bad Gateway');
    }
    close(`upstream error ${e.code || e.message}`);
  });
  clientSocket.on('error', (e) => close(`client error ${e.code || e.message}`));
  upstream.on('close', () => close('upstream closed'));
  clientSocket.on('close', () => close('client closed'));
  clientSocket.setNoDelay(true);
  upstream.setNoDelay(true);
  clientSocket.setKeepAlive(true, 30000);
}

// ------------------------------------------------------------------ start

const server = createServer(
  {
    cert: readFileSync(cfg.cert),
    key: readFileSync(cfg.key),
    minVersion: 'TLSv1.2',
  },
  serveStatic,
);
server.on('upgrade', proxyWebSocket);
server.on('clientError', (_err, socket) => socket.destroy());
server.listen(cfg.port, cfg.bind, () => {
  logLine(
    `FS-WebRTC listening on https://${cfg.bind}:${cfg.port} static=${cfg.staticDir} sip-upstream=${cfg.upstream.href}`,
  );
});

const shutdown = (sig) => {
  logLine(`${sig} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
