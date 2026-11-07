# Deployment (M2 – SERVER CHANGE, APPROVAL REQUIRED)

**Target:** `192.168.1.133:/opt/freeswitch-ui/fs-webrtc` (deployment only, never edited).
**Not touched:** `/opt/freeswitch-ui/fs-cc*`, `fs-enrs*`, `fs-react-ui`, the `*.sh` scripts, nginx, PM2 apps, FreeSWITCH.

## Pre-deployment checks (`SAFE`)

| Check                                    | Command                                                                  | Expected                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Server identity                          | `hostname; hostname -I`                                                  | `freeswitch`, includes 192.168.1.133       |
| Target absent or known                   | `ls -la /opt/freeswitch-ui/fs-webrtc`                                    | "No such file" on first deploy             |
| Port free                                | `ss -ltn 'sport = :8443'`                                                | header line only                           |
| Node version                             | `node --version`                                                         | ≥ v22 (v24.16.0 seen)                      |
| Git remote / commit                      | `git -C /opt/freeswitch-ui/fs-webrtc remote -v; git -C … rev-parse HEAD` | approved remote and commit                 |
| Do the dev scripts loop over subfolders? | `grep -n 'for .* in\|\*/' /opt/freeswitch-ui/*.sh`                       | review that none would pick up `fs-webrtc` |

## Steps

1. `useradd --system --no-create-home --shell /usr/sbin/nologin fswebrtc`
2. `git clone <approved-remote> /opt/freeswitch-ui/fs-webrtc` then `git -C /opt/freeswitch-ui/fs-webrtc checkout <approved-commit>`
3. `cd /opt/freeswitch-ui/fs-webrtc && npm ci && npm run build`
4. Certificates: guide E-4 (`/opt/freeswitch-ui/fs-webrtc-certs`, owner `fswebrtc`, 600).
5. Firewall: guide Part J.
6. `cp server/fs-webrtc.service.example /etc/systemd/system/fs-webrtc.service && systemctl daemon-reload && systemctl enable --now fs-webrtc`
7. Verify: `systemctl status fs-webrtc` (active), `journalctl -u fs-webrtc -n 20` (shows the "listening" line), and the smoke test from DEV_PC with `node scripts/smoke-server.mjs https://192.168.1.133:8443`.
8. Post-check FreeSWITCH: `sofia status` shows 4 profiles RUNNING, and existing registrations are intact.

## Updating later

`git fetch && git checkout <approved-commit> && npm ci && npm run build && systemctl restart fs-webrtc`. Server-local settings live only in the systemd unit and the certificate folder, so updates keep them.

## Rollback

See `ROLLBACK.md`.
