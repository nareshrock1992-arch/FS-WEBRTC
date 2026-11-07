#!/usr/bin/env node
/**
 * SAFE smoke test for server/server.mjs (read-only towards FreeSWITCH).
 * Run while the server is running. Uses the mkcert root CA via NODE_EXTRA_CA_CERTS,
 * so TLS verification stays ON.
 *
 *   NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" node scripts/smoke-server.mjs https://localhost:8443
 *
 * Checks: health, security headers, path traversal guard, Origin check, sub-protocol check,
 * and a real WebSocket handshake (protocol "sip") through the proxy to FreeSWITCH, closed
 * immediately – no REGISTER is sent.
 */
import { request } from 'node:https';

const base = new URL(process.argv[2] || 'https://localhost:8443');
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
  if (!ok) failures += 1;
};

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(new URL(path, base), { method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode, headers: res.headers, body: '' });
    });
    req.on('error', reject);
    req.end();
  });
}

const health = await get('/healthz');
check('GET /healthz is 200', health.status === 200);
check(
  'CSP header present',
  /default-src 'self'/.test(health.headers['content-security-policy'] || ''),
);
check('nosniff header', health.headers['x-content-type-options'] === 'nosniff');

const index = await get('/');
check('GET / serves index.html', index.status === 200 && index.body.includes('id="app"'));

const traversal = await get('/..%2f..%2fpackage.json');
check(
  'path traversal blocked',
  !traversal.body.includes('"devDependencies"'),
  `status ${traversal.status}`,
);

const wsHeaders = {
  Connection: 'Upgrade',
  Upgrade: 'websocket',
  'Sec-WebSocket-Version': '13',
  'Sec-WebSocket-Key': Buffer.from('fs-webrtc-smoke!').toString('base64'),
};
const badOrigin = await get('/sip', {
  ...wsHeaders,
  'Sec-WebSocket-Protocol': 'sip',
  Origin: 'https://evil.example',
});
check('foreign Origin refused (403)', badOrigin.status === 403);

const noProto = await get('/sip', { ...wsHeaders, Origin: base.origin });
check('missing sip sub-protocol refused (400)', noProto.status === 400);

const ok = await get('/sip', {
  ...wsHeaders,
  'Sec-WebSocket-Protocol': 'sip',
  Origin: base.origin,
});
check(
  'WSS handshake proxied to FreeSWITCH (101, protocol sip)',
  ok.status === 101 && ok.headers['sec-websocket-protocol'] === 'sip',
  `status ${ok.status}`,
);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
