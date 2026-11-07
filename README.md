# FS-WebRTC

A standalone browser softphone proof of concept for an existing FreeSWITCH server.
Used to learn, simulate and validate WebRTC calling before any future FS-CC / FS-ENRS integration.
It has **no dependency on FS-CC or FS-ENRS**.

## What it does

Sign in with a SIP extension, register over secure WebSocket (WSS), make and receive calls with two-way audio (WebRTC, DTLS-SRTP, OPUS), plus answer, reject, hang up, mute, hold/resume, DTMF, call timer, microphone and speaker selection, reconnection and log out.

## How it fits together

```
Browser ──HTTPS──► FS-WebRTC server (:8443) ──serves the app
Browser ──WSS /sip──► FS-WebRTC server ──WS (same host)──► FreeSWITCH :5066
Browser ◄══DTLS-SRTP voice (UDP 16384–32768)══► FreeSWITCH
```

Why the proxy: see `docs/ARCHITECTURE.md` (Option A: zero FreeSWITCH configuration changes).

## Quick start (developer laptop)

```bash
npm ci
```

```bash
npm run check
```

```bash
npm run dev
```

Full step-by-step instructions for non-developers are in **[IMPLEMENTATION_PROCEDURE_GUIDE.md](IMPLEMENTATION_PROCEDURE_GUIDE.md)**.

## Project layout

| Path                                      | Purpose                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/sip/`                                | SIP.js wrappers (UserAgent, Registerer, call media helpers)                                       |
| `src/services/`                           | `PhoneService` facade, call state machine, reconnect, store                                       |
| `src/audio/`                              | microphone/speaker devices, remote audio, ringtones                                               |
| `src/components/`, `src/pages/`           | user interface                                                                                    |
| `src/config/`, `src/types/`, `src/utils/` | config (no secrets), shared types, validation, redacting logger                                   |
| `server/`                                 | HTTPS static server + WSS→WS proxy, systemd template                                              |
| `freeswitch/`                             | password-free templates for the lab users and isolated lab dialplan                               |
| `scripts/`                                | smoke tests                                                                                       |
| `tests/unit/`                             | Vitest unit tests                                                                                 |
| `docs/`                                   | architecture, certificates, FreeSWITCH lab config, deployment, testing, troubleshooting, rollback |

## Security

Read [SECURITY.md](SECURITY.md). In short, this is a **lab** tool: the browser necessarily holds its own SIP password.

## Governance

Claude sessions must follow [CLAUDE_GOVERNANCE.md](CLAUDE_GOVERNANCE.md).
