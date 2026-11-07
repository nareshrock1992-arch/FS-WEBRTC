# SECURITY.md

## Scope

FS-WebRTC is a **LAN lab proof of concept**. It is not production-secure, and WSS alone doesn't make it so.

## Browser SIP credential model – known limitation

- The browser performs SIP digest authentication itself, so the SIP password must exist in browser memory while you are signed in.
- Anyone using that browser profile, any malicious browser extension or any script-injection (XSS) bug could read it.
- **Controls in this POC:**
  - The password is typed at login, kept only in memory, never written to `localStorage`, `sessionStorage`, cookies, URLs or logs, and dropped on logout or page close.
  - The password field is cleared after each submit.
  - Strict Content-Security-Policy (`script-src 'self'`, `connect-src 'self'`); no third-party scripts; no `innerHTML` (enforced by a lint rule).
  - Lab accounts are confined to an isolated dialplan context (no PSTN, queues, IVRs or real extensions).
- **Production direction (future phase):** the application backend authenticates the user and issues short-lived SIP credentials or tokens, revoked on logout or expiry. See the M4 integration design.

## Transport and media

| Layer          | Protection                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App download   | HTTPS (TLS ≥ 1.2), mkcert lab CA trusted on the client                                                                                                       |
| SIP signalling | WSS from browser to the FS-WebRTC server. The plain WS hop to FreeSWITCH :5066 stays **inside the FreeSWITCH host**. `ws://` URLs are refused by the client. |
| Voice          | WebRTC-mandatory DTLS-SRTP, keys verified through the SDP fingerprint                                                                                        |
| Proxy          | Accepts only path `/sip` with sub-protocol `sip`, same-origin `Origin` only, connection cap                                                                  |
| ICE            | No STUN/TURN servers configured, so nothing is sent off the LAN                                                                                              |

## Secrets handling

- Never commit `.env*`, `certs/*`, `*.pem`, `*.key` (enforced by `.gitignore`).
- The mkcert **root CA private key** stays in `mkcert -CAROOT` on the developer laptop. Never copy it anywhere.
- The server certificate private key lives outside the git checkout, mode 600, owned by the service user.
- SIP.js logs pass through a redacting logger (Authorization headers and digest fields masked). Production log level is `warn`.

## Dependencies

- All versions pinned exactly (`save-exact`), with a committed lockfile.
- `npm audit` (2026-11-07): **0 vulnerabilities in runtime dependencies** (`sip.js` in the browser, `ws` in the server proxy). 10 moderate findings in dev-only lint tooling (`minimatch` ReDoS via eslint/typescript-eslint). These are not shipped to browsers and are only reachable with attacker-controlled glob patterns at lint time, so they're accepted for the lab and re-checked on every upgrade.

## Pre-existing server issues (outside this project, reported in M0)

ESL on 0.0.0.0:8021 with the stock password · stock `default_password` on 21 users · ENRS key in plaintext `vars.xml` · world-writable dialplan/Lua files. Fix these before exposing anything beyond the lab.

## Reporting

This is a private lab project. Report issues to the repository owner.
