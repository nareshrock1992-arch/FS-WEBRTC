# Architecture

## Components

```
┌──────────────── Browser (Chrome/Edge) ────────────────┐
│ pages/  login-page, phone-page                        │  UI only
│ components/ status-bar, banner, call-panel, dialpad,  │
│             device-picker, dom (textContent helpers)  │
├───────────────────────────────────────────────────────┤
│ services/ PhoneService  ← the single facade for UI    │  reusable
│           call-state (pure reducer), reconnect, store │  (no UI code)
│ sip/      SipClient (UserAgent+Registerer),           │
│           call-session (hold, mute, DTMF, mic switch) │
│ audio/    devices, remote-audio, ringtone             │
│ config/ types/ utils/ (validation, redacting logger)  │
└──────────────┬──────────────────────────┬─────────────┘
       HTTPS + WSS /sip (TLS)       DTLS-SRTP over UDP (ICE)
               │                          │
┌──────────────▼───────────┐   ┌──────────▼─────────────────────┐
│ server/server.mjs :8443  │   │ FreeSWITCH internal profile    │
│ static dist/ + headers   │──►│ ws :5066 (existing)            │
│ /sip WSS→WS proxy        │ WS│ RTP 16384–32768, OPUS, rfc2833 │
└──────────────────────────┘   │ context webrtc_lab (new file)  │
       same host 192.168.1.133 └────────────────────────────────┘
```

## Why Option A (proxy) instead of FreeSWITCH's own WSS (7443)

FreeSWITCH reads its WSS certificate only from `wss.pem`. The existing one has no SAN and isn't trusted, and the brief forbids overwriting it. Option A puts TLS on the FS-WebRTC server, which presents a trusted mkcert certificate, and relays to the existing plain WS listener on the same machine. Result: **zero FreeSWITCH configuration changes and no profile restart.** Option B (`tls-cert-dir` on the internal profile) remains a possible later learning step, with approval.

### Lesson learned: Via transport rewrite (verified 2026-11-07)

SIP.js writes `Via: SIP/2.0/WSS …` because the browser uses `wss://`. FreeSWITCH's SIP stack **silently discards** requests whose Via says WSS when they arrive on its plain `ws` listener. A byte-for-byte proxy therefore never gets a reply to REGISTER. `server/server.mjs` relays individual WebSocket messages and `server/sip-via.mjs` rewrites only the Via transport token: `WSS→WS` towards FreeSWITCH, and `WS→WSS` back on the browser's own `*.invalid` Via in replies. SDP bodies are never touched.

## Call flows

**Registration:** browser → `REGISTER` over WSS → proxy → FreeSWITCH replies `401` (digest challenge) → SIP.js re-sends with Authorization → `200 OK`. SIP.js refreshes it before the 300 s expiry.

**Outgoing call (7990001 → 7990002):** `INVITE` with an SDP offer (OPUS, ICE candidates, DTLS fingerprint) → FreeSWITCH `webrtc_lab` context → `bridge user/7990002` → FreeSWITCH sends a new `INVITE` to browser B over its WSS → B answers → FreeSWITCH answers A. FreeSWITCH anchors media for both legs (B2BUA), so each browser has its own DTLS-SRTP session with FreeSWITCH.

**Media:** ICE connectivity checks (STUN) between the browser and 192.168.1.133:<RTP port> → DTLS handshake (keys checked against the SDP fingerprint) → SRTP-encrypted OPUS audio.

**Hold:** re-INVITE with `a=sendonly`; FreeSWITCH plays music on hold to the other party. **Mute:** the local track is disabled (no signalling). **DTMF:** RFC 4733 telephone-events (payload 101) through `RTCDTMFSender`, with SIP INFO as a fallback.

## Reconnection

WebSocket lost → status "Reconnecting (attempt n)" → exponential back-off (2 s, 4 s, 8 s … max 30 s, ±20 %) → on reconnect, re-REGISTER. Browser `online` triggers an immediate retry. Wrong password (401/403/407) never retries automatically.
**Known limitation:** an established call's media may continue during a short WebSocket drop, but in-dialog signalling (BYE/re-INVITE) needs the transport. After a long outage FreeSWITCH may end the call when its RTP times out (300 s).

## State

`PhoneService.store` holds `PhoneState` (connection, registration, account without password, call, devices, error, notice). The UI renders purely from that state.
