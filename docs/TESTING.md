# Testing

## Automated (M1 – executed 2026-11-07)

| ID   | Test                                                                                     | Command                    | Result                        |
| ---- | ---------------------------------------------------------------------------------------- | -------------------------- | ----------------------------- |
| A-01 | Type check                                                                               | `npm run typecheck`        | PASS                          |
| A-02 | Lint (incl. no-innerHTML rule)                                                           | `npm run lint`             | PASS                          |
| A-03 | Format                                                                                   | `npm run format:check`     | PASS                          |
| A-04 | Unit tests (validation, call state, reconnect back-off, redaction, timer, store, config) | `npm test`                 | PASS – 64/64                  |
| A-05 | Production build                                                                         | `npm run build`            | PASS – 249 kB JS (59 kB gzip) |
| A-06 | Server: health, CSP, nosniff, index, traversal guard                                     | `scripts/smoke-server.mjs` | PASS                          |
| A-07 | Server: foreign Origin → 403, missing `sip` protocol → 400                               | same                       | PASS                          |
| A-08 | Server: real WS handshake through proxy to FreeSWITCH :5066 → 101 `sip`                  | same                       | PASS (no REGISTER sent)       |
| A-09 | Runtime dependency audit                                                                 | `npm audit --omit=dev`     | PASS – 0 vulnerabilities      |

**Not yet tested** (needs M2 server setup and real browsers): everything below. **Nothing below has been claimed as working.**

## Manual browser tests (M2/M3) – template

Fill in for each: Test ID · Objective · Procedure · Expected · Actual · Pass/Fail · Evidence · Defect ref.

| ID   | Objective                 | Procedure                                          | Expected                                                                                        |
| ---- | ------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| M-01 | Trusted HTTPS             | open `https://192.168.1.133:8443` on both PCs      | padlock, no warning                                                                             |
| M-02 | WSS connects              | sign in as 7990001                                 | status "Connected"                                                                              |
| M-03 | Valid registration        | same                                               | "Registered"; server `sofia status profile internal reg` lists 7990001                          |
| M-04 | Invalid password          | sign in with wrong password                        | "wrong extension or password", back on login page, no retries in FS log                         |
| M-05 | Microphone permission     | first sign-in                                      | browser prompt; denying shows a clear message                                                   |
| M-06 | Echo / two-way media path | A dials 9196                                       | you hear yourself; webrtc-internals: DTLS connected, bytes both ways                            |
| M-07 | Outgoing call             | A dials 7990002                                    | A "Ringing…", B shows incoming                                                                  |
| M-08 | Incoming + answer         | B clicks Answer                                    | both "In call", timer runs                                                                      |
| M-09 | **Two-way audio**         | speak on each side (headsets, two people or rooms) | each side hears the other – **human-verified only**                                             |
| M-10 | Reject                    | A calls, B rejects                                 | A shows "Declined"                                                                              |
| M-11 | Hangup                    | either side hangs up                               | both return to idle; `show channels count` = 0                                                  |
| M-12 | Mute                      | A mutes                                            | B hears silence; unmute restores                                                                |
| M-13 | Hold/resume               | A holds                                            | B hears hold music; resume restores two-way audio                                               |
| M-14 | DTMF                      | A dials 9197, presses 1 2 3 #                      | digits read back; FS log `DTMF received: 123`                                                   |
| M-15 | Device selection          | change mic/speaker during a call                   | audio moves to the new device                                                                   |
| M-16 | Browser refresh           | refresh the page on A                              | must sign in again; old registration replaced or expires                                        |
| M-17 | Network disconnect        | unplug A's network 20 s, replug                    | "Reconnecting (attempt n)" → "Registered"                                                       |
| M-18 | Busy                      | A calls B while B is in a call                     | A gets "Busy"                                                                                   |
| M-19 | Multiple sessions         | same extension in two tabs                         | document FreeSWITCH behaviour (last registration wins unless multiple-registrations is enabled) |
| M-20 | Lab isolation             | A dials 1001, 2020, 9 + 10 digits                  | all refused                                                                                     |
| M-21 | FreeSWITCH health         | before/after                                       | 4 profiles RUNNING, 1001 still registered, gateways unchanged                                   |
| M-22 | RTP range                 | during a call `ss -uanp \| grep freeswitch`        | port within 16384–32768                                                                         |
