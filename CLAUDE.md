# CLAUDE.md

Before doing anything in this repository, read and follow **[CLAUDE_GOVERNANCE.md](CLAUDE_GOVERNANCE.md)**.
It is mandatory for every session (boundaries, approval gates, workflow, secret handling).

Quick facts:

- Stack: TypeScript + Vite + SIP.js 0.21.2 (full API). Node server (`server/server.mjs`) = HTTPS + WSS→WS proxy.
- Verify: `npm run check` (typecheck, lint, format, unit tests, build).
- Layering: `src/sip`, `src/services`, `src/audio`, `src/types`, `src/utils` contain no UI code (reusable for future FS-CC/FS-ENRS integration). UI lives in `src/components` and `src/pages`.
