# FS-WebRTC – Implementation Procedure Guide

This guide takes you from zero to a working browser softphone on FreeSWITCH. It is written for a non-developer. Every step says where to run it, what it changes, what you should see, and how to undo it.

**Status column:** ✅ done in M1 (2026-11-07) · ⏳ not yet done, M2 needs approval · 🔁 repeat whenever needed.

**Labels:** `SAFE` read-only · `LOCAL CHANGE` · `SERVER CHANGE` · `FREESWITCH CHANGE` · `SECURITY-SENSITIVE` · `APPROVAL REQUIRED`

---

## 0. Your environment values (change these for another installation)

Every command below uses these names. Another administrator must substitute their own values. **Do not assume these addresses exist elsewhere.**

| Name                      | This lab's value                                        | Meaning                                          |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `DEV_PC`                  | 192.168.1.123 (Windows laptop)                          | where you develop and test endpoint A            |
| `TEST_PC_2`               | 192.168.1.56                                            | second browser endpoint (B)                      |
| `FS_HOST`                 | 192.168.1.133                                           | FreeSWITCH server                                |
| `FS_WS_PORT`              | 5066                                                    | FreeSWITCH plain WebSocket port (already exists) |
| `APP_PORT`                | 8443                                                    | FS-WebRTC HTTPS + WSS port (new)                 |
| `FS_CONF`                 | /opt/freeswitch/etc/freeswitch                          | FreeSWITCH configuration folder                  |
| `SIP_DOMAIN`              | 192.168.1.133                                           | FreeSWITCH domain (`global_getvar domain`)       |
| `LAB_EXT_A` / `LAB_EXT_B` | 7990001 / 7990002                                       | new isolated lab extensions                      |
| `LAB_PASSWORD`            | _(given to you separately – never written in any file)_ | lab-only SIP password                            |
| `REPO`                    | C:\Users\naresh\Documents\fs-webrtc                     | local repository (authoritative)                 |
| `DEPLOY_DIR`              | /opt/freeswitch-ui/fs-webrtc                            | server checkout (deployment only)                |
| `CERT_DIR`                | /opt/freeswitch-ui/fs-webrtc-certs                      | server certificate folder (new)                  |

---

## Part A – Windows development setup

### A-1 Check what is installed ✅ `SAFE`

- **Objective / why:** find out which tools are missing before installing anything.
- **Where:** PowerShell on `DEV_PC`.
- **Command:**
  ```bash
  node --version; npm --version; git --version; mkcert -version
  ```
- **Expected:** version numbers, or "not recognized" for each missing tool.
- **Interpretation:** any "not recognized" means do A-2.
- **Changes:** nothing.

### A-2 Install Node.js LTS, Git and mkcert ✅ `LOCAL CHANGE` `APPROVAL REQUIRED`

- **Objective:** Node.js runs the build tools; Git tracks every change; mkcert creates trusted lab certificates.
- **What it does:** downloads the official installers through Windows Package Manager and installs them. Windows may ask for administrator permission.
- **Where:** PowerShell on `DEV_PC`.
- **Commands (one at a time):**
  ```bash
  winget install --id OpenJS.NodeJS.LTS -e
  ```
  ```bash
  winget install --id Git.Git -e
  ```
  ```bash
  winget install --id FiloSottile.mkcert -e
  ```
- **Expected:** `Successfully installed` for each. Installed in M1: Node 26.13.0, npm 11.20.0, Git 2.56.0, mkcert 1.4.4.
- **Then:** close and reopen PowerShell so the new tools are found, and repeat A-1.
- **Common errors:** `winget` not found → install "App Installer" from the Microsoft Store. "Agreements" prompt → answer Y.
- **Rollback:** `winget uninstall --id <same id>`.

---

## Part B – Local Git repository

### B-1 Create the repository folder ✅ `LOCAL CHANGE` `APPROVAL REQUIRED`

- **Why:** FS-WebRTC must be its own project, separate from FS-CC and FS-ENRS.
- **Where:** PowerShell.
- **Commands:**
  ```bash
  Test-Path C:\Users\naresh\Documents\fs-webrtc
  ```
  It must print `False`. If it prints `True`, **stop**: something already exists there, so inspect it first.
  ```bash
  git init -b main C:\Users\naresh\Documents\fs-webrtc
  ```
- **Expected:** `Initialized empty Git repository …`.
- **Rollback:** delete the folder (only if it holds nothing you want).

### B-2 Check repository state before any work 🔁 `SAFE`

- **Why:** governance rule. Always know which folder, branch and commit you are on.
- **Command (inside `REPO`):**
  ```bash
  git status --short --branch
  ```
- **Expected:** `## main` (or `## No commits yet on main`) followed by changed files.

### B-3 Commit (only when approved) ⏳ `LOCAL CHANGE` `APPROVAL REQUIRED`

- **Commands:** `git add -A`, then `git status` (check that no `.env`, `.pem` or `.key` files are listed), then `git commit -m "…"`.
- **Rollback:** `git reset --soft HEAD~1` (keeps your files, undoes only the commit).

---

## Part C – Installing SIP.js and the other libraries

### C-1 Install the exact pinned dependencies ✅🔁 `LOCAL CHANGE`

- **Why:** `package.json` and `package-lock.json` pin exact versions, so everyone gets identical code.
- **Where:** PowerShell in `REPO`.
- **Command:**
  ```bash
  npm ci
  ```
- **Expected:** `added NNN packages`. This creates `node_modules\` (never committed).
- **Pinned versions (2026-11-07):** sip.js 0.21.2 · vite 8.3.6 · typescript 6.0.3 (7.x isn't yet supported by typescript-eslint) · vitest 5.1.0 · eslint 10.14.0 · typescript-eslint 8.72.1 · prettier 3.9.10 · jsdom 31.0.0.
- **Common errors:** `npm ci` complains about the lockfile → someone edited `package.json` by hand; run `npm install` once, then review the diff.

### C-2 Check dependency security 🔁 `SAFE`

```bash
npm audit --omit=dev
```

- **Expected:** `found 0 vulnerabilities` (runtime). `npm audit` without `--omit=dev` shows 10 moderate dev-tool findings (minimatch); see `SECURITY.md`.

---

## Part D – Development

### D-1 Run every automated check 🔁 `SAFE` (writes only `dist\`)

```bash
npm run check
```

- **What it does:** type-check → lint (code-quality and security rules) → format check → 64 unit tests → production build into `dist\`.
- **Expected (M1 result):** `Tests 64 passed`, `✓ built`, exit code 0.
- **If lint or format fails:** run `npm run format`, then repeat the check.

### D-2 Run the development server 🔁 `LOCAL CHANGE` (local process only)

- **Prerequisite:** the localhost certificate (E-2).

```bash
npm run dev
```

- **Expected:** `Local: https://localhost:5173/`. Open it in Chrome.
- **Talking to FreeSWITCH from the dev server** (`SECURITY-SENSITIVE`, lab only): create `.env.local` containing `DEV_SIP_WS_UPSTREAM=ws://192.168.1.133:5066`. SIP signalling then travels **unencrypted across the LAN** between your PC and the server. Prefer the deployed server (Part N) for real tests.

---

## Part E – Certificates

### E-0 Why two kinds of certificate?

| Certificate                            | Used for                                                                        | Name (SAN) it must contain               | Lives on                                  |
| -------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Local dev certificate                  | `https://localhost:5173` while developing                                       | `localhost`, `127.0.0.1`                 | `DEV_PC` only (`REPO\certs`, git-ignored) |
| Server app certificate                 | `https://192.168.1.133:8443`, covering **both** the web page and the `/sip` WSS | `IP:192.168.1.133` (+ optional DNS name) | `CERT_DIR` on the server                  |
| FreeSWITCH `wss.pem` / `dtls-srtp.pem` | existing; **not used and not changed** by Option A                              | –                                        | untouched                                 |

**mkcert vs self-signed:** mkcert creates a private "root CA" on your PC. Once that root is trusted, every certificate it issues is trusted automatically. A self-signed certificate has to be imported manually on every client, and again after every renewal. **mkcert is simpler and more reliable for a LAN lab.**

### E-1 Trust the mkcert root CA on Windows ⏳ `LOCAL CHANGE` `SECURITY-SENSITIVE` — **you run this yourself**

- **What it does:** adds the mkcert root certificate to Windows' "Trusted Root Certification Authorities". Chrome and Edge then trust certificates issued by it. Windows shows a security warning; read it and click **Yes**.
- **Command:**
  ```bash
  mkcert -install
  ```
- **Expected:** `The local CA is now installed in the system trust store!`
- **Security:** the root CA private key is in the folder shown by `mkcert -CAROOT` (`C:\Users\naresh\AppData\Local\mkcert`). **Never copy `rootCA-key.pem` anywhere.** Whoever holds it can create certificates your browser will trust.
- **Rollback:**
  ```bash
  mkcert -uninstall
  ```

### E-2 Create the local dev certificate ✅ `LOCAL CHANGE`

```bash
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1
```

- **Expected:** `The certificate is at "certs/localhost.pem" …`, valid until 7 Feb 2029. Both files are git-ignored.

### E-3 Create the server app certificate ⏳ `LOCAL CHANGE` `SECURITY-SENSITIVE`

```bash
mkcert -cert-file certs/fs-webrtc.pem -key-file certs/fs-webrtc-key.pem 192.168.1.133 freeswitch.mylab.com
```

- **Check the SAN** (Git for Windows includes openssl):
  ```bash
  & "C:\Program Files\Git\usr\bin\openssl.exe" x509 -in certs/fs-webrtc.pem -noout -subject -ext subjectAltName -enddate
  ```
  The output must include `IP Address:192.168.1.133`.

### E-4 Copy the server certificate to the server ⏳ `SERVER CHANGE` `SECURITY-SENSITIVE` `APPROVAL REQUIRED`

- **What it does:** copies the certificate and **its** private key (never the CA key) over SSH, then locks down ownership and permissions.

```bash
scp certs/fs-webrtc.pem certs/fs-webrtc-key.pem root@192.168.1.133:/opt/freeswitch-ui/fs-webrtc-certs/
```

On the server:

```bash
chown -R fswebrtc:fswebrtc /opt/freeswitch-ui/fs-webrtc-certs && chmod 700 /opt/freeswitch-ui/fs-webrtc-certs && chmod 600 /opt/freeswitch-ui/fs-webrtc-certs/*
```

- **Expected (`ls -la`):** `-rw------- fswebrtc fswebrtc` on both files.
- **Renewal (~every 27 months):** repeat E-3 and E-4, then `systemctl restart fs-webrtc`.
- **Rollback:** `rm /opt/freeswitch-ui/fs-webrtc-certs/fs-webrtc*.pem`.

### E-5 Trust the root CA on the second PC (192.168.1.56) ⏳ `LOCAL CHANGE (other PC)` `SECURITY-SENSITIVE`

- Copy **only** `rootCA.pem` (the public part) from `mkcert -CAROOT` to the second PC.
- Double-click it → Install Certificate → Local Machine → "Trusted Root Certification Authorities".
- **Rollback:** `certmgr.msc` → Trusted Root → delete "mkcert …".

---

## Part F – FreeSWITCH assessment (read-only) 🔁 `SAFE`

Run on the server as root. None of these commands change anything.

| Check                | Command                                                                                                      | Expected in this lab         |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Profiles running     | `/opt/freeswitch/bin/fs_cli -x "sofia status"`                                                               | 4 profiles `RUNNING`         |
| Internal profile WS  | `fs_cli -x "sofia status profile internal" \| grep -E "WS-BIND\|WSS-BIND\|RTP-IP"`                           | `ws` on 192.168.1.133:5066   |
| Active calls         | `fs_cli -x "show channels count"`                                                                            | `0 total.` before any change |
| Registrations        | `fs_cli -x "sofia status profile internal reg"`                                                              | lists registered users       |
| Pending config edits | `find /opt/freeswitch/etc/freeswitch -type f -newer /opt/freeswitch/var/log/freeswitch/freeswitch.xml.fsxml` | empty output                 |
| Port listening       | `ss -ltnp \| grep -E ':5066\|:8443'`                                                                         | 5066 freeswitch              |
| Domain               | `fs_cli -x "global_getvar domain"`                                                                           | 192.168.1.133                |

**Caution:** some commands start things. For example, `pm2 ls` starts a PM2 daemon if none is running. Stick to the commands above.

---

## Part G – Lab extension creation ⏳ `FREESWITCH CHANGE` `SECURITY-SENSITIVE` `APPROVAL REQUIRED`

### G-1 Pre-checks `SAFE`

Run Part F. Confirm `0 total.` channels, no pending config edits, and that 7990001/7990002 don't exist:

```bash
grep -rl "7990001\|7990002" /opt/freeswitch/etc/freeswitch
```

**Expected:** no output.

### G-2 Create the two user files (new files only)

- **What it does:** defines two SIP users that can only use the isolated `webrtc_lab` dialplan.
- **Where:** server, as root. The password is typed interactively, so it never appears in shell history or files in the repo.

```bash
read -rsp "Lab SIP password: " LABPW; echo; for EXT in 7990001 7990002; do sed -e "s/__EXT__/$EXT/g" -e "s/__PASSWORD__/$LABPW/" /opt/freeswitch-ui/fs-webrtc/freeswitch/webrtc_lab_user.xml.template > /opt/freeswitch/etc/freeswitch/directory/default/webrtc_lab_$EXT.xml; done; unset LABPW
```

```bash
chown freeswitch:freeswitch /opt/freeswitch/etc/freeswitch/directory/default/webrtc_lab_799000*.xml && chmod 640 /opt/freeswitch/etc/freeswitch/directory/default/webrtc_lab_799000*.xml
```

- **Avoid** a password containing `/` or `&` (they break the `sed` command).

### G-3 Install the isolated lab dialplan (new file only)

```bash
install -o freeswitch -g freeswitch -m 640 /opt/freeswitch-ui/fs-webrtc/freeswitch/webrtc_lab.xml /opt/freeswitch/etc/freeswitch/dialplan/webrtc_lab.xml
```

### G-4 Validate the XML before loading

```bash
for f in /opt/freeswitch/etc/freeswitch/directory/default/webrtc_lab_799000*.xml /opt/freeswitch/etc/freeswitch/dialplan/webrtc_lab.xml; do python3 -c "import sys,xml.dom.minidom as m; m.parse(sys.argv[1]); print('OK', sys.argv[1])" "$f"; done
```

**Expected:** `OK …` three times. If any file fails, **do not** run G-5; fix it or roll back.

### G-5 Load the new configuration

- **What it does:** `reloadxml` re-reads all XML. It does **not** drop calls or registrations and does not restart profiles. It _would_ also pick up anyone else's unsaved edits, which is why the pending-edit check exists.

```bash
/opt/freeswitch/bin/fs_cli -x reloadxml
```

**Expected:** `+OK [Success]`.

### G-6 Verify

```bash
/opt/freeswitch/bin/fs_cli -x "user_exists id 7990001 192.168.1.133"
```

**Expected:** `true`. Repeat for 7990002.

**Rollback (G):**

```bash
rm /opt/freeswitch/etc/freeswitch/directory/default/webrtc_lab_799000*.xml /opt/freeswitch/etc/freeswitch/dialplan/webrtc_lab.xml && /opt/freeswitch/bin/fs_cli -x reloadxml
```

---

## Part H – WSS setup (Option A: same-origin proxy) — concept

- The browser connects to `wss://192.168.1.133:8443/sip`. TLS uses the mkcert certificate (E-3).
- The FS-WebRTC server passes each WebSocket to FreeSWITCH's **existing** `ws://192.168.1.133:5066`, inside the same machine.
- FreeSWITCH settings and `wss.pem` are **unchanged**, and no profile restart is needed.
- **Important (learned in M2):** FreeSWITCH silently ignores SIP requests whose `Via` says `WSS` when they arrive on its plain WS port. The proxy therefore rewrites the Via transport in each message (`server/sip-via.mjs`). A simple byte pipe does **not** work.
- **Headless registration check** (`SAFE`, registers for a moment, then un-registers). Run in PowerShell; it asks for the password without echoing it:
  ```bash
  $env:NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)\rootCA.pem"; $env:SIP_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host -AsSecureString "Lab password"))); node scripts/register-test.mjs wss://192.168.1.133:8443/sip 7990001 192.168.1.133; Remove-Item Env:SIP_PASSWORD
  ```
  **Expected:** `PASS REGISTER 7990001@192.168.1.133 -> 200 OK`. With a wrong password: `FAIL REGISTER rejected 403 Forbidden`.
- Verified in M1: a real WebSocket handshake with sub-protocol `sip` through the proxy to FreeSWITCH returned `101 Switching Protocols`. Test it yourself with step M-2.

---

## Part I – HTTPS setup on the server ⏳ `SERVER CHANGE` `APPROVAL REQUIRED`

See Part N (deployment): the same service provides both HTTPS and WSS.

---

## Part J – Firewall ⏳ `SERVER CHANGE` `SECURITY-SENSITIVE` `APPROVAL REQUIRED`

- **Why:** the server drops all incoming traffic unless a rule allows it. Port 8443 is not open today.
- **Look first (`SAFE`):**
  ```bash
  iptables -S INPUT | grep -E "8443|7443|16384"
  ```
- **Add (LAN only):**
  ```bash
  iptables -I INPUT -p tcp -s 192.168.1.0/24 --dport 8443 -j ACCEPT
  ```
- **Expected:** no output. `iptables -S INPUT | grep 8443` then shows the rule.
- **Not persistent:** the rule disappears at reboot unless you save it (your decision).
- **Voice ports:** UDP 16384–32768 are already open, so no change is needed.
- **Rollback:**
  ```bash
  iptables -D INPUT -p tcp -s 192.168.1.0/24 --dport 8443 -j ACCEPT
  ```

---

## Part K – RTP (voice ports) 🔁 `SAFE`

- `switch.conf.xml` has `rtp-start-port`/`rtp-end-port` commented out, so FreeSWITCH uses its default range **16384–32768**.
- **Confirm during a live call:**
  ```bash
  ss -uanp | grep freeswitch
  ```
  You should see a UDP port inside 16384–32768.
- In Chrome, `chrome://webrtc-internals` shows the remote candidate `192.168.1.133:<port>` and growing `bytesReceived`/`bytesSent`.

---

## Part L – Browser configuration 🔁

1. Use Chrome or Edge. Firefox needs extra certificate setup.
2. Open `https://192.168.1.133:8443`. The padlock must show **no** warning. **Never click "Proceed anyway"**; fix trust instead (E-1/E-5).
3. Allow the microphone when asked. To change it later: padlock → Site settings → Microphone.
4. Use a headset for two-way tests to avoid echo.
5. If the page says "The browser blocked audio playback", click **Enable audio**.

---

## Part M – Testing

### M-1 Unit tests 🔁 `SAFE`

`npm run check` (see D-1).

### M-2 Server smoke test 🔁 `SAFE` (opens one WebSocket to FreeSWITCH and closes it; no REGISTER)

On `DEV_PC`, start the server, then run the smoke test:

```bash
$env:FSW_TLS_CERT='certs/localhost.pem'; $env:FSW_TLS_KEY='certs/localhost-key.pem'; node server/server.mjs
```

In a second PowerShell window:

```bash
$env:NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)\rootCA.pem"; node scripts/smoke-server.mjs https://localhost:8443
```

- **Expected (M1 result):** 8× `PASS`, ending with `All smoke checks passed`.

### M-3 Browser tests (M2/M3)

These follow `docs/TESTING.md`. Start with the echo test (dial 9196): if you hear yourself, the media path works in both directions.

---

## Part N – Deployment ⏳ `SERVER CHANGE` `APPROVAL REQUIRED`

Full details are in `docs/DEPLOYMENT.md`. Summary:

1. Verify (`SAFE`): `hostname` is `freeswitch`; `/opt/freeswitch-ui/fs-webrtc` doesn't exist yet; port 8443 is free.
2. Create the service user: `useradd --system --no-create-home --shell /usr/sbin/nologin fswebrtc`.
3. `git clone <approved remote> /opt/freeswitch-ui/fs-webrtc`, then `npm ci && npm run build` there. No code is edited on the server.
4. Certificates (E-4), firewall (J).
5. Copy `server/fs-webrtc.service.example` to `/etc/systemd/system/fs-webrtc.service`, then run `systemctl daemon-reload && systemctl enable --now fs-webrtc`.
6. Verify: `systemctl status fs-webrtc`, and `curl --cacert rootCA.pem https://192.168.1.133:8443/healthz` → `ok`.
7. Post-check FreeSWITCH (Part F): all profiles RUNNING and 1001 still registered.

---

## Part O – Linux environment setup (another server)

Requires Node.js ≥ 22 (`node --version`), git and openssl. If missing on Debian/Ubuntu, install Node.js LTS from the distribution or NodeSource. `APPROVAL REQUIRED` on any shared server.

---

## Part P – Backup 🔁

| What                              | How                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Local repo                        | `git` history, plus a copy of `REPO` (excluding `node_modules`)                              |
| mkcert CA                         | `mkcert -CAROOT` folder, stored encrypted offline. **SECURITY-SENSITIVE**                    |
| Server FreeSWITCH config before G | `tar czf /root/fs-conf-before-webrtc-$(date +%F-%H%M).tgz -C /opt/freeswitch/etc freeswitch` |

---

## Part Q – Rollback (everything) — see `docs/ROLLBACK.md`

The order is: stop the service → remove the firewall rule → remove the lab FreeSWITCH files and `reloadxml` → remove the deploy folder and user → `mkcert -uninstall` on the clients.

---

## Part R – Troubleshooting — see `docs/TROUBLESHOOTING.md`

---

## Part S – Installing on another Linux server

1. Fill in section 0 with that server's values: IP, WS port (`sofia status profile internal`), domain, free app port, free extensions.
2. Run Part F there, read-only.
3. If that FreeSWITCH has no `ws-binding`, Option A needs one, which is a profile change and needs separate approval.
4. Follow parts E-3/E-4 with the new IP in the SAN, then G, J and N with the new values.
