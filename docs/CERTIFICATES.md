# Certificates

The full procedure is in `IMPLEMENTATION_PROCEDURE_GUIDE.md` Part E. Summary:

| Certificate                           | SAN                                            | Where                                                                                 | Owner/mode        | Renewal                                         |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------- |
| mkcert root CA                        | –                                              | `mkcert -CAROOT` on the dev laptop; the public `rootCA.pem` is trusted on each client | your Windows user | 10 years                                        |
| localhost dev                         | `localhost`, `127.0.0.1`                       | `REPO/certs/` (git-ignored)                                                           | –                 | ~27 months                                      |
| server app (HTTPS + WSS proxy)        | `IP:192.168.1.133`, `DNS:freeswitch.mylab.com` | `/opt/freeswitch-ui/fs-webrtc-certs/`                                                 | `fswebrtc` 600    | ~27 months: re-issue, copy, restart the service |
| FreeSWITCH `wss.pem`, `dtls-srtp.pem` | –                                              | `/opt/freeswitch/etc/freeswitch/tls`                                                  | unchanged         | **not touched**                                 |

## Rules

- Never disable certificate validation and never click "Proceed anyway".
- Never copy `rootCA-key.pem`.
- Private keys never go into Git.

## Rollback

Run `mkcert -uninstall` on each client and delete the server certificate files.
