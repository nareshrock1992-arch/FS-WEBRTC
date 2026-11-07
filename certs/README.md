# certs/

Local development certificates live here. **Everything in this folder except this README is git-ignored.**

Expected files (created with mkcert, see `IMPLEMENTATION_PROCEDURE_GUIDE.md` step L-6):

- `localhost.pem` – certificate for `localhost` / `127.0.0.1`
- `localhost-key.pem` – its private key (SECURITY-SENSITIVE, never share or commit)

The mkcert **root CA private key** is NOT here. It stays in mkcert's own folder (`mkcert -CAROOT`).
