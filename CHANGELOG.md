# Changelog

## [0.1.0] – 2026-11-07 – M1 local implementation (not yet committed)

### Added

- TypeScript + Vite project, SIP.js 0.21.2 (full API), exact-pinned dependencies.
- Softphone features: login (extension, password, domain, WSS URL), registration and status, dial pad, outgoing and incoming calls, answer, reject (603), busy (486) when already in a call, hang up/cancel, mute, hold/resume (re-INVITE), DTMF (RFC 2833 with SIP INFO fallback), call timer, microphone and speaker selection, mid-call microphone switch, device hot-plug, autoplay unlock, ringback and ring tones, exponential-backoff reconnect, online/offline handling, auth-failure handling without retry storms, logout.
- `server/server.mjs`: HTTPS static server + same-origin WSS→WS proxy (Option A), security headers, Origin and sub-protocol checks.
- FreeSWITCH lab templates: user template, isolated `webrtc_lab` context (users 7990001/7990002, echo 9196, DTMF test 9197).
- Unit tests (64), ESLint (with no-innerHTML rule), Prettier, server smoke test script.
- Documentation: implementation procedure guide, governance, architecture, certificates, FreeSWITCH lab config, deployment, testing, troubleshooting, rollback, security.
