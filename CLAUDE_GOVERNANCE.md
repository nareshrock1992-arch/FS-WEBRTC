# CLAUDE_GOVERNANCE.md – Mandatory rules for every Claude session on FS-WebRTC

These rules apply to **every** future session. If a request conflicts with them, stop and ask.

## 1. Boundaries

| Rule                                | Detail                                                                                                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local repo is authoritative         | `C:\Users\naresh\Documents\fs-webrtc` is the only place code is written.                                                                                                                                             |
| Server checkout is deployment-only  | `192.168.1.133:/opt/freeswitch-ui/fs-webrtc` – never edit code there; deploy only via the approved procedure.                                                                                                        |
| FS-CC and FS-ENRS are out of bounds | No edits, no reads of source/DB/env beyond metadata, no symlinks, no shared code, no dependencies, no service actions in `/opt/freeswitch-ui/fs-cc*`, `/opt/freeswitch-ui/fs-enrs*`, their databases or nginx sites. |
| FreeSWITCH                          | No change, `reloadxml`, profile restart or service restart without explicit approval of that specific action. Never edit existing XML files; never touch `tls/wss.pem` or `tls/dtls-srtp.pem`.                       |
| Git                                 | No commit, push, tag, branch deletion, reset, rebase, clean, stash-drop or force operations without explicit approval. Preserve untracked and modified files.                                                        |
| Deployment                          | No deployment without explicit approval.                                                                                                                                                                             |
| Secrets                             | Never print, log, commit or store SIP passwords, private keys, API keys or `.env` values. Redact before showing output. The lab password is never written to any file in the repo.                                   |
| Server commands                     | Read-only by default. Beware commands with side effects (e.g. `pm2 ls` starts a daemon).                                                                                                                             |

## 2. Mandatory workflow

0. **Verify environment and boundary** – `pwd`, `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`, `git status --short`. Confirm you are in the FS-WebRTC repo.
1. **Read-only audit** of whatever the change touches.
2. **Design Impact Assessment** – what changes, where (LOCAL / SERVER / FREESWITCH), risk, rollback.
3. **User approval** – explicit, for that change.
4. **Implementation** – smallest change that works.
5. **Automated tests** – `npm run check` must pass.
6. **Manual tests** – real browser where relevant; never claim audio works without a human hearing it.
7. **Documentation update** – `IMPLEMENTATION_PROCEDURE_GUIDE.md`, `CHANGELOG.md`, affected `docs/`.
8. **Diff and security review** – `git diff`, search for secrets, CSP/validation impact.
9. **Commit approval.**
10. **Push approval.**
11. **Deployment approval.**
12. **Post-deployment verification** – health check, FreeSWITCH profiles RUNNING, existing registrations intact.

## 3. Change record

- Every server/FreeSWITCH change must be added to `docs/SERVER_CHANGE_REGISTER.md` (what, when, approval, verification, rollback) in the same session.
- Every fix must be documented in `CHANGELOG.md`, the relevant `IMPLEMENTATION_PROCEDURE_GUIDE.md` part and `docs/TROUBLESHOOTING.md` (symptom → cause → fix).
- Known approved exception: `sip_profiles/internal.xml` contains `apply-candidate-acl=localnet.auto` (C-09). Any further edit to existing FreeSWITCH files needs new explicit approval.
- FreeSWITCH XML: never put `X-PRE-PROCESS` text in comments; it is executed anyway.

## 4. Reporting rules

- Distinguish verified facts from assumptions.
- Report failures with the actual output.
- Report any accidental side effect immediately, with the exact undo command.
- Label every step: SAFE · LOCAL CHANGE · SERVER CHANGE · FREESWITCH CHANGE · SECURITY-SENSITIVE · APPROVAL REQUIRED.
