# How FS-WebRTC Works – a plain-language guide

**For:** the system owner (not a full-time developer, new to FreeSWITCH).
**State described:** lab as of 2026-11-07, all features verified working by the owner.
**Companion documents:** step-by-step commands are in `IMPLEMENTATION_PROCEDURE_GUIDE.md`; every server change is listed in `docs/SERVER_CHANGE_REGISTER.md`.

---

## 1. The whole thing in one minute

1. You open **https://192.168.1.133:8443** in a browser. A small web server called **FS-WebRTC** (new, ours) sends the softphone page.
2. The page signs in to FreeSWITCH as extension **7990001** or **7990002**. The sign-in travels over an encrypted WebSocket (`wss://…:8443/sip`) to the FS-WebRTC server, which passes it to FreeSWITCH's **existing** WebSocket port **5066** on the same machine.
3. When you call, FreeSWITCH looks up what that number means in a **dialplan** (routing rules). For our lab users that is a new, isolated set of rules called **`webrtc_lab`**.
4. Your **voice does not go through the FS-WebRTC server.** It travels directly between the browser and FreeSWITCH over UDP, encrypted (DTLS-SRTP), using the OPUS codec.

```
 Browser (laptop .123 / PC .56)                 Server 192.168.1.133
 ┌──────────────────────────┐                   ┌────────────────────────────────────────┐
 │ FS-WebRTC page (SIP.js)  │ ① HTTPS :8443     │ FS-WebRTC server (Node, service        │
 │                          │ ─────────────────►│ "fs-webrtc") – serves the page         │
 │                          │ ② WSS :8443/sip   │   │ rewrites "Via WSS→WS", passes SIP  │
 │                          │ ═════════════════►│   ▼ (inside the server)                │
 │                          │                   │ FreeSWITCH profile "internal"          │
 │                          │                   │   WS port 5066 (already existed)       │
 │ microphone / speaker     │ ③ voice: UDP      │   users 7990001/7990002 (new files)    │
 │                          │ ◄════════════════►│   dialplan context webrtc_lab (new)    │
 │                          │  DTLS-SRTP, OPUS  │   RTP ports 16384–32768                │
 └──────────────────────────┘                   └────────────────────────────────────────┘
```

---

## 2. FreeSWITCH crash course (only what you need for this project)

### 2.1 Where things live

| Folder / file                                             | What it is                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/opt/freeswitch/bin/freeswitch`                          | the FreeSWITCH program (runs as service `freeswitch.service`, user `freeswitch`)                                                |
| `/opt/freeswitch/bin/fs_cli`                              | the command console. `fs_cli -x "command"` runs one command and exits.                                                          |
| `/opt/freeswitch/etc/freeswitch/`                         | **all configuration** (called `FS_CONF` below)                                                                                  |
| `FS_CONF/freeswitch.xml`                                  | the master file. It doesn't hold settings itself; it **includes** the others (vars, profiles, directory, dialplan).             |
| `FS_CONF/vars.xml`                                        | global variables, e.g. `domain` = 192.168.1.133 and the default codecs                                                          |
| `FS_CONF/sip_profiles/`                                   | **SIP profiles** = SIP "listeners" (IP + ports + behaviour). `internal.xml` is the one phones and browsers use.                 |
| `FS_CONF/directory/`                                      | **users** (extensions) and their passwords. `directory/default/*.xml` = one file per user.                                      |
| `FS_CONF/dialplan/`                                       | **routing rules**: what happens when someone dials a number. Grouped into **contexts**.                                         |
| `FS_CONF/autoload_configs/`                               | module settings (`switch.conf.xml` RTP ports, `acl.conf.xml` network lists, `event_socket.conf.xml` ESL…)                       |
| `FS_CONF/tls/`                                            | certificates (`wss.pem` for FreeSWITCH's own WSS 7443, `dtls-srtp.pem` for media encryption)                                    |
| `/opt/freeswitch/var/log/freeswitch/freeswitch.log`       | the main log: the first place to look when something fails                                                                      |
| `/opt/freeswitch/var/log/freeswitch/freeswitch.xml.fsxml` | the **compiled** configuration FreeSWITCH is actually using (all includes merged). Great for checking that a change was loaded. |

### 2.2 How a configuration change takes effect

FreeSWITCH reads XML files into memory. Editing a file changes **nothing** until you tell FreeSWITCH to reload. There are three levels, from gentlest to strongest:

| Action              | Command                                      | What it reloads                             | Disruption                                                                               |
| ------------------- | -------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Reload XML          | `fs_cli -x reloadxml`                        | users (directory) and dialplan              | none: calls and registrations continue                                                   |
| Restart one profile | `fs_cli -x "sofia profile internal restart"` | SIP profile settings (ports, ACLs, codecs…) | drops calls and registrations **on that profile only**; phones re-register automatically |
| Restart FreeSWITCH  | `systemctl restart freeswitch`               | everything                                  | drops everything (**never used in this project**)                                        |

### 2.3 Key words

- **Profile (Sofia profile):** a SIP listener. Your server has 4: `internal` (192.168.1.133:5060, WS 5066, WSS 7443), `internal-tailscale`, `external`, `external-ipv6`.
- **Domain:** the "@" part of a SIP address. Here it's the IP `192.168.1.133`, so a user is `7990001@192.168.1.133`.
- **Directory user:** an extension with a password and variables (caller ID, context…).
- **Context:** a named group of dialplan rules. A user's `user_context` variable decides which group their calls use. That's how we **isolate** the lab users.
- **Extension (dialplan):** one rule inside a context: "if the dialed number matches X, do Y".
- **ACL:** a list of allowed/denied networks. `localnet.auto` is created automatically and means "this server's own LAN" (192.168.1.0/24).

---

## 3. Every FreeSWITCH file involved

### 3.1 Files we CREATED (new; nothing existing was overwritten)

#### a) `FS_CONF/directory/default/webrtc_lab_7990001.xml` and `…_7990002.xml` – the two lab users

Owner `freeswitch`, mode `640` (only FreeSWITCH can read the password). They are loaded automatically because `directory/default.xml` already includes `default/*.xml`. Content, with the password replaced here:

```xml
<include>
  <user id="7990001">                                  <!-- the extension number / SIP user name -->
    <params>
      <param name="password" value="(lab password)"/>  <!-- SIP password the browser signs in with -->
    </params>
    <variables>
      <variable name="user_context" value="webrtc_lab"/>          <!-- ★ calls use ONLY the lab rules -->
      <variable name="effective_caller_id_name" value="WebRTC Lab 7990001"/>
      <variable name="effective_caller_id_number" value="7990001"/>
      <variable name="accountcode" value="webrtc_lab"/>
      <variable name="toll_allow" value=""/>           <!-- no domestic/international dialing rights -->
    </variables>
  </user>
</include>
```

- Why 7990001/7990002: they were verified free (no `799xxxx` anywhere), and they avoid 1000–1019 and the `700xxxx` numbers your other projects use.
- Template in the repo: `freeswitch/webrtc_lab_user.xml.template` (it has a placeholder; the real password is never stored in Git).

#### b) `FS_CONF/dialplan/webrtc_lab.xml` – the isolated lab dialplan (context `webrtc_lab`)

Loaded automatically because `freeswitch.xml` already includes `dialplan/*.xml`. Owner `freeswitch`, mode 640.

| Rule (extension)                  | Matches                | What it does                                                                                   |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `webrtc_lab_users`                | `7990001` or `7990002` | `bridge user/<number>@192.168.1.133`: rings that browser; 30 s timeout                         |
| `webrtc_lab_echo`                 | `9196`                 | answers and plays your own audio back (proves two-way media)                                   |
| `webrtc_lab_dtmf_test`            | `9197`                 | answers, collects keypad digits until `#`, logs `webrtc_lab DTMF received: …`, reads them back |
| `webrtc_lab_deny_everything_else` | anything else          | logs a warning and hangs up (`NO_ROUTE_DESTINATION`)                                           |

The result: a lab user **cannot** reach the PSTN trunk, queues, IVRs or real extensions, even if the lab password leaked. Repo copy: `freeswitch/webrtc_lab.xml`.

### 3.2 The ONE existing file we EDITED (approved separately)

#### `FS_CONF/sip_profiles/internal.xml` – one line added (lines 137–138)

```xml
    <param name="local-network-acl" value="localnet.auto"/>            <!-- existing line 136 -->
    <!-- FS-WebRTC 2026-11-07: allow WebRTC ICE candidates from the local LAN only ... -->
    <param name="apply-candidate-acl" value="localnet.auto"/>          <!-- ★ added -->
```

- **Why:** browsers tell FreeSWITCH which IP addresses they can receive audio on (ICE "candidates"). Without this line, FreeSWITCH only accepts public internet addresses (`wan.auto`). It rejected `192.168.1.56` and hung up (`INCOMPATIBLE_DESTINATION`).
- **Effect on others:** only WebRTC/browser calls use ICE. Desk phones and MicroSIP are unaffected.
- **Backup:** `internal.xml.bak-20261107-104229` (same folder).
- **Activated with:** `sofia profile internal restart` (done with 0 active calls).

### 3.3 Existing files USED but NOT changed

| File / setting                                                 | Why it matters to us                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `internal.xml` line 326 `ws-binding :5066`                     | the plain WebSocket port our proxy connects to                                                                        |
| `internal.xml` line 330 `wss-binding :7443`                    | FreeSWITCH's own WSS; **not used** (its certificate isn't browser-trusted and we may not overwrite it)                |
| `internal.xml` lines 104–105 `sip-ip`/`rtp-ip` = 192.168.1.133 | the address put into SDP for audio                                                                                    |
| `internal.xml` line 87 `context default`                       | the default for normal users; our users override it with `user_context`                                               |
| `vars.xml` `domain=$${local_ip_v4}` → 192.168.1.133            | the SIP domain the browser signs in to                                                                                |
| `vars.xml` `global_codec_prefs` = OPUS,G722,PCMU,PCMA…         | OPUS is first, so browsers get high-quality audio                                                                     |
| `autoload_configs/switch.conf.xml` RTP ports (commented out)   | default range **16384–32768** is used for audio                                                                       |
| `autoload_configs/acl.conf.xml`                                | `localnet.auto` is auto-generated, so nothing needed adding                                                           |
| `tls/dtls-srtp.pem`                                            | FreeSWITCH's certificate for encrypting media (DTLS). Browsers check it by fingerprint, not trust, so it works as is. |
| `tls/wss.pem`                                                  | **not used, not touched**                                                                                             |
| `freeswitch.xml`, `directory/default.xml`                      | their existing `include` lines pick up our new files automatically                                                    |

---

## 4. Things outside FreeSWITCH that were created on the server

| Item                           | Location                                               | Purpose                                                                                  |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| App checkout (deployment only) | `/opt/freeswitch-ui/fs-webrtc`                         | code from GitHub `nareshrock1992-arch/FS-WEBRTC`, built into `dist/`                     |
| Service                        | `/etc/systemd/system/fs-webrtc.service`                | runs `server/server.mjs` as user `fswebrtc` on 192.168.1.133:8443                        |
| Service user                   | `fswebrtc` (system user, no login)                     | least privilege                                                                          |
| Certificate                    | `/opt/freeswitch-ui/fs-webrtc-certs/` (700, files 600) | mkcert certificate for `IP:192.168.1.133` + `freeswitch.mylab.com`, valid until Feb 2029 |
| Firewall                       | iptables: TCP 8443 from 192.168.1.0/24                 | lets LAN browsers reach the app. **Not persistent**: lost at reboot unless saved.        |
| Trust on clients               | mkcert root CA installed on the laptop and PC .56      | browsers trust the certificate (no warnings, no bypass)                                  |

---

## 5. The journey of a call

### 5.1 Signing in (REGISTER)

1. The browser loads the page over HTTPS, and you allow the microphone.
2. SIP.js opens `wss://192.168.1.133:8443/sip`. The FS-WebRTC server checks the Origin and the `sip` sub-protocol, then opens `ws://192.168.1.133:5066` to FreeSWITCH.
3. The browser sends `REGISTER`. The proxy changes `Via: SIP/2.0/WSS` to `WS` (FreeSWITCH ignores WSS-labelled messages on its WS port; see problem P1).
4. FreeSWITCH answers `401` (a "prove you know the password" challenge). SIP.js answers with a digest (a hash; the password itself is never sent). FreeSWITCH checks it against the user file and replies `200 OK`.
5. FreeSWITCH now shows `Registered(WS-NAT)` for the user (`fs_cli -x "sofia status profile internal reg"`). SIP.js renews it every few minutes.

### 5.2 Making a call 7990001 → 7990002

1. A sends `INVITE 7990002` with an SDP offer: codecs, its IP candidates, and a DTLS fingerprint.
2. FreeSWITCH sees that A's `user_context` is `webrtc_lab`, so it reads `dialplan/webrtc_lab.xml`. The rule `webrtc_lab_users` matches and runs `bridge user/7990002`.
3. FreeSWITCH sends a **new** INVITE to B over B's WebSocket. B rings, and you click Answer.
4. **Media:** each browser does ICE (connectivity checks) with FreeSWITCH's RTP port. FreeSWITCH accepts only LAN candidates (`apply-candidate-acl=localnet.auto`). Then a DTLS handshake creates SRTP keys, and OPUS audio flows. FreeSWITCH sits in the middle of both legs, so it can record, play hold music, detect DTMF and so on.
5. **Hold:** a re-INVITE with `sendonly`; FreeSWITCH plays hold music to the other side. **Mute:** the browser simply stops sending the microphone (no signalling). **DTMF:** sent as RFC 2833 "telephone-event" packets (payload 101), which FreeSWITCH expects.
6. **Hang up:** a `BYE` message; both legs end.

---

## 6. Problems we hit, and how each was fixed

| #   | Symptom                                                                | Real cause                                                                                                                                                                          | Fix                                                                                         | Where documented                                    |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| P1  | Browser connected, but sign-in got no reply                            | the browser labels messages `Via …/WSS`; FreeSWITCH **silently drops** WSS-labelled requests arriving on its plain WS port                                                          | the proxy rewrites only the Via transport word (`server/sip-via.mjs`); no FreeSWITCH change | guide Part H, ARCHITECTURE, TROUBLESHOOTING         |
| P2  | `Error including …/dialplan/dialplan/*.xml` in the log after reloadxml | a comment in our dialplan file contained the text of an include instruction; **FreeSWITCH executes those even inside comments**                                                     | removed the text, re-installed, reloaded (clean)                                            | guide Part G, TROUBLESHOOTING                       |
| P3  | Call answered, then instantly "Remote party hung up"                   | the profile had no candidate ACL, so it defaulted to `wan.auto` (public IPs only) and rejected all LAN audio addresses (`no suitable candidates found`, `INCOMPATIBLE_DESTINATION`) | approved one-line profile change `apply-candidate-acl=localnet.auto` + profile restart      | guide Part G2, FREESWITCH_LAB_CONFIG, register C-09 |

---

## 7. Repeating this on another FreeSWITCH server (checklist)

Fill in that server's own values first (`IMPLEMENTATION_PROCEDURE_GUIDE.md` §0: IP, WS port, domain, free app port, free extensions).

1. **Audit (read-only):** `sofia status`, `sofia status profile internal` (check that a `ws-binding` exists), `global_getvar domain`, existing users, free numbers, RTP range, firewall. → guide Part F
2. **Developer PC:** Node.js, Git, mkcert; `npm ci`; `npm run check`. → Parts A–D
3. **Certificates:** `mkcert -install` on each client; issue a certificate with that server's IP in the SAN; copy it to the server (600, service user). → Part E
4. **Lab users and lab context:** new files from `freeswitch/`, XML validation, `reloadxml`, `user_exists`. → Part G
5. **Candidate ACL:** add `apply-candidate-acl` (an ACL matching your browsers' LAN) to the internal profile; backup; profile restart at 0 calls. → Part G2
6. **Deploy:** service user, `git clone`, `npm ci && npm run build`, systemd unit (change IP, port, upstream WS), start. → Part N
7. **Firewall:** allow the app port from the LAN only. UDP RTP must be open too (it already was here). → Parts J, K
8. **Verify:** smoke test, `scripts/register-test.mjs`, then a browser echo test on 9196, a call between two browsers, and the full `docs/TESTING.md` list.
9. **Record** every change in `docs/SERVER_CHANGE_REGISTER.md`.

---

## 8. Everyday command cheat sheet (run on the server as root; all SAFE unless marked)

| Question                                                    | Command                                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Is FreeSWITCH healthy?                                      | `/opt/freeswitch/bin/fs_cli -x "sofia status"` (4 profiles RUNNING)                                               |
| Who is registered (browsers)?                               | `fs_cli -x "sofia status profile internal reg"`                                                                   |
| Any calls right now?                                        | `fs_cli -x "show channels count"` / `fs_cli -x "show calls"`                                                      |
| Does a user exist?                                          | `fs_cli -x "user_exists id 7990001 192.168.1.133"`                                                                |
| Which context does a user use?                              | `fs_cli -x "user_data 7990001@192.168.1.133 var user_context"`                                                    |
| Is the web app up?                                          | `systemctl status fs-webrtc` / `journalctl -u fs-webrtc -n 30`                                                    |
| Watch the FreeSWITCH log live                               | `tail -f /opt/freeswitch/var/log/freeswitch/freeswitch.log`                                                       |
| Lab-specific log lines                                      | `grep -a webrtc_lab /opt/freeswitch/var/log/freeswitch/freeswitch.log \| tail`                                    |
| Is the candidate ACL loaded?                                | `grep -a apply-candidate-acl /opt/freeswitch/var/log/freeswitch/freeswitch.log \| tail -1`                        |
| Reload users/dialplan after editing (**FREESWITCH CHANGE**) | `fs_cli -x reloadxml`                                                                                             |
| Restart the app after an update (**SERVER CHANGE**)         | `cd /opt/freeswitch-ui/fs-webrtc && git pull --ff-only && npm ci && npm run build && systemctl restart fs-webrtc` |

In the browser: `chrome://webrtc-internals` shows the live ICE, DTLS and audio byte counters of a call.

---

## 9. Glossary

| Term                     | Meaning                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **SIP**                  | the signalling language of VoIP: REGISTER (sign in), INVITE (call), BYE (hang up)                                |
| **WebSocket (WS / WSS)** | a long-lived connection from a web page to a server; WSS = encrypted. SIP over WebSocket is defined in RFC 7118. |
| **SIP.js**               | the JavaScript library in the page that speaks SIP                                                               |
| **WebRTC**               | the browser's built-in real-time audio/video engine                                                              |
| **SDP**                  | the "offer/answer" text describing codecs, IP addresses and encryption fingerprints                              |
| **ICE / candidate**      | how two endpoints find a working network path; each candidate is an IP:port to try                               |
| **DTLS-SRTP**            | encryption for the audio: DTLS exchanges the keys, SRTP encrypts the packets                                     |
| **RTP**                  | the packets that carry audio (UDP ports 16384–32768 here)                                                        |
| **OPUS**                 | the high-quality audio codec browsers prefer                                                                     |
| **DTMF / RFC 2833**      | keypad tones sent as special RTP events (payload 101)                                                            |
| **Context**              | a named set of dialplan rules; decides what a user is allowed to dial                                            |
| **ACL**                  | a network allow/deny list (`localnet.auto` = this server's LAN)                                                  |
| **mkcert**               | a tool that creates a private certificate authority so your own PCs trust lab certificates                       |
| **B2BUA**                | "back-to-back user agent": FreeSWITCH terminates each call leg separately and connects them                      |
