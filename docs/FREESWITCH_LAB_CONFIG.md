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

## Procedure

`IMPLEMENTATION_PROCEDURE_GUIDE.md` Part G (pre-checks, creation, validation, reload, verification, rollback).
