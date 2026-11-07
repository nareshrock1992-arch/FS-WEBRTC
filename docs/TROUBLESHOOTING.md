# Troubleshooting

| Symptom                                        | Likely cause                                         | Check / fix                                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page shows a certificate warning               | mkcert root not trusted on this PC                   | Guide E-1 (laptop) or E-5 (second PC). Never click "Proceed".                                                                                                         |
| "This page must be opened over HTTPS"          | opened via `http://` or an IP without TLS            | use `https://192.168.1.133:8443`                                                                                                                                      |
| "Could not open the secure WebSocket"          | service down, firewall, or untrusted cert            | `systemctl status fs-webrtc`; `iptables -S INPUT \| grep 8443`; open `https://192.168.1.133:8443/healthz` in the browser                                              |
| Connected but "Registration failed (SIP 408…)" | proxy cannot reach FreeSWITCH :5066                  | `journalctl -u fs-webrtc` shows `upstream error`; `ss -ltn \| grep 5066`                                                                                              |
| "wrong extension or password"                  | credentials, or the lab users aren't loaded          | `fs_cli -x "user_exists id 7990001 192.168.1.133"`; re-check `reloadxml`                                                                                              |
| Calls connect but no audio                     | ICE/RTP path, mDNS candidates, firewall UDP          | `chrome://webrtc-internals`: is ICE "connected"? Are `bytesReceived` growing? Server: `ss -uanp \| grep freeswitch` during the call. UDP 16384–32768 must be allowed. |
| One-way audio                                  | wrong output device, autoplay block, mute/hold state | click "Enable audio"; check the speaker selection; check the Mute button state                                                                                        |
| "The browser blocked audio playback"           | autoplay policy                                      | click "Enable audio" (any click on the page unlocks it)                                                                                                               |
| Microphone permission denied                   | site permission                                      | padlock → Site settings → Microphone → Allow, then reload                                                                                                             |
| Speaker selection missing                      | browser lacks `setSinkId` (e.g. Firefox before 116)  | use Chrome/Edge; the system default is used otherwise                                                                                                                 |
| Calls to 1001 etc. refused                     | by design (isolated `webrtc_lab` context)            | expected                                                                                                                                                              |
| Hold doesn't play music                        | re-INVITE rejected                                   | browser console shows "Hold/resume refused (SIP …)"; check FreeSWITCH log                                                                                             |
| DTMF not detected                              | FreeSWITCH expects RFC 2833 (payload 101)            | dial 9197; check the log for `webrtc_lab DTMF received`                                                                                                               |
| Keeps saying "Reconnecting"                    | server unreachable                                   | ping 192.168.1.133; `systemctl status fs-webrtc`                                                                                                                      |
| `npm ci` fails                                 | lockfile mismatch / no Node                          | `node --version` (≥ 22); see guide C-1                                                                                                                                |

**Useful server commands (SAFE):**

- `fs_cli -x "sofia status profile internal reg"`
- `fs_cli -x "show channels"`
- `journalctl -u fs-webrtc -f`
- `grep -a webrtc_lab /opt/freeswitch/var/log/freeswitch/freeswitch.log | tail`
