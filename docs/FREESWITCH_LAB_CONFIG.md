# FreeSWITCH lab configuration (M2 – APPROVAL REQUIRED)

## Principle

Add **new files only**. Never edit existing XML, certificates, profiles, gateways, queues or IVR.

| New file                                   | Purpose                       | Source in repo                            |
| ------------------------------------------ | ----------------------------- | ----------------------------------------- |
| `directory/default/webrtc_lab_7990001.xml` | lab user A                    | `freeswitch/webrtc_lab_user.xml.template` |
| `directory/default/webrtc_lab_7990002.xml` | lab user B                    | same                                      |
| `dialplan/webrtc_lab.xml`                  | isolated context `webrtc_lab` | `freeswitch/webrtc_lab.xml`               |

Activation: `fs_cli -x reloadxml` (no call or registration drop).

## Why these numbers

Verified free on 2026-11-07: no `799xxxx` anywhere in the config, the call-centre agents or the registrations. They avoid 1000–1019 and the `700xxxx` pattern used by the other projects.

## What the lab users can dial (`webrtc_lab` context)

| Number            | Result                                                                |
| ----------------- | --------------------------------------------------------------------- |
| 7990001 / 7990002 | rings the other lab browser                                           |
| 9196              | echo test (hear yourself)                                             |
| 9197              | DTMF test (digits read back and logged as `webrtc_lab DTMF received`) |
| anything else     | refused (`NO_ROUTE_DESTINATION`), logged as a warning                 |

## Side note

The existing `default` context contains a generic 7-digit rule (`local-7-digit-extensions`). Existing users could therefore _call_ the lab users. That's harmless (inbound only) and needs no change.

## Profile change: WebRTC ICE candidate ACL (approved and applied 2026-11-07)

**Symptom:** a browser-to-browser call reached "ringing" and "answered", then immediately showed "Remote party hung up". FreeSWITCH log:

```
[WARNING] switch_core_media.c NO candidate ACL defined, Defaulting to wan.auto
[DEBUG]   switch_core_media.c ... no suitable candidates found.
[NOTICE]  Hangup ... [INCOMPATIBLE_DESTINATION]
```

**Why:**

- In WebRTC, each browser lists the IP addresses it can receive audio on (ICE "candidates"), e.g. `192.168.1.56`.
- FreeSWITCH only accepts candidates that match the profile's `apply-candidate-acl`.
- With no setting, it uses `wan.auto`, which means public internet addresses only. So every LAN address was rejected and FreeSWITCH could find nowhere to send audio.
- Normal SIP phones (MicroSIP etc.) don't use ICE and are not affected by this setting.

**Change (the only edit to an existing FreeSWITCH file in this project):**

```xml
<param name="local-network-acl" value="localnet.auto"/>
<!-- FS-WebRTC 2026-11-07: allow WebRTC ICE candidates from the local LAN only (default would be wan.auto = public IPs only) -->
<param name="apply-candidate-acl" value="localnet.auto"/>
```

`localnet.auto` is built automatically by FreeSWITCH from the server's own LAN (192.168.1.0/24). Only LAN addresses are accepted; Tailscale, Docker, VPN and IPv6 candidates are still ignored.

**Activation:** `sofia profile internal restart`. This drops calls and registrations on the internal profile only; devices re-register by themselves. Run it only when `show channels count` = 0.

**Implementing on another server:** this line is required for any browser (WebRTC) client on a private LAN. Use the ACL that matches where your browsers are (`localnet.auto` for the same subnet, `rfc1918.auto` for any private range, or a custom list in `acl.conf.xml`).

Full procedure: `IMPLEMENTATION_PROCEDURE_GUIDE.md` Part G2. Change record: `SERVER_CHANGE_REGISTER.md` C-09.

## Procedure

`IMPLEMENTATION_PROCEDURE_GUIDE.md` Part G (pre-checks, creation, validation, reload, verification, rollback).
