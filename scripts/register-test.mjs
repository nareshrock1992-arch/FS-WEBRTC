#!/usr/bin/env node
/**
 * Headless SIP registration check using SIP.js (same library as the browser app).
 * SAFE for the lab: registers for 60 s, then un-registers. No call is placed.
 *
 * PowerShell:
 *   $env:NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)\rootCA.pem"
 *   $env:SIP_PASSWORD = Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText   (PowerShell 7)
 *   node scripts/register-test.mjs wss://192.168.1.133:8443/sip 7990001 192.168.1.133
 *
 * The password is read from the SIP_PASSWORD environment variable and never printed.
 * Exit code 0 = registered and un-registered, 1 = failure.
 */
import { Registerer, RegistererState, UserAgent } from 'sip.js';

const [server, ext, domain] = process.argv.slice(2);
const password = process.env.SIP_PASSWORD;
if (!server || !ext || !domain || !password) {
  console.error(
    'usage: SIP_PASSWORD=... node scripts/register-test.mjs <wss-url> <extension> <domain>',
  );
  process.exit(2);
}

const ua = new UserAgent({
  uri: UserAgent.makeURI(`sip:${ext}@${domain}`),
  transportOptions: { server, connectionTimeout: 10 },
  authorizationUsername: ext,
  authorizationPassword: password,
  logBuiltinEnabled: false,
  userAgentString: 'FS-WebRTC register-test',
});
const registerer = new Registerer(ua, { expires: 60 });

const timeout = setTimeout(() => {
  console.log('FAIL  no final response within 15 s');
  process.exit(1);
}, 15000);

try {
  await ua.start();
  console.log(`PASS  WSS connected to ${server}`);
  const outcome = await new Promise((resolve) => {
    registerer.stateChange.addListener((s) => {
      if (s === RegistererState.Registered) resolve('registered');
    });
    registerer
      .register({
        requestDelegate: {
          onReject: (r) => resolve(`rejected ${r.message.statusCode} ${r.message.reasonPhrase}`),
        },
      })
      .catch((e) => resolve(`error ${e.message}`));
  });
  if (outcome !== 'registered') {
    console.log(`FAIL  REGISTER ${outcome}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS  REGISTER ${ext}@${domain} -> 200 OK`);
    await registerer.unregister();
    await new Promise((r) => setTimeout(r, 500));
    console.log('PASS  un-REGISTER sent');
  }
} catch (e) {
  console.log(`FAIL  ${e.message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  await ua.stop().catch(() => {});
}
