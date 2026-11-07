import { describe, expect, it } from 'vitest';
// @ts-expect-error – plain ESM module from the Node server, no type declarations
import { toBrowser, toFreeSwitch } from '../../server/sip-via.mjs';

const REGISTER = [
  'REGISTER sip:192.168.1.133 SIP/2.0',
  'Via: SIP/2.0/WSS abc123.invalid;branch=z9hG4bK1',
  'To: <sip:7990001@192.168.1.133>',
  'Content-Length: 0',
  '',
  '',
].join('\r\n');

describe('toFreeSwitch', () => {
  it('rewrites the Via transport WSS -> WS', () => {
    const out: string = toFreeSwitch(REGISTER);
    expect(out).toContain('Via: SIP/2.0/WS abc123.invalid;branch=z9hG4bK1');
    expect(out).not.toContain('WSS');
  });

  it('handles compact "v:" headers and odd spacing', () => {
    expect(toFreeSwitch('INVITE x SIP/2.0\r\nv: SIP / 2.0 / WSS h.invalid\r\n\r\n')).toContain(
      'v: SIP/2.0/WS h.invalid',
    );
  });

  it('never touches the body (SDP)', () => {
    const msg = 'MESSAGE x SIP/2.0\r\nVia: SIP/2.0/WSS h.invalid\r\n\r\nVia: SIP/2.0/WSS keep-me';
    expect(toFreeSwitch(msg)).toContain('\r\n\r\nVia: SIP/2.0/WSS keep-me');
  });

  it('passes CRLF keep-alives through unchanged', () => {
    expect(toFreeSwitch('\r\n\r\n')).toBe('\r\n\r\n');
  });
});

describe('toBrowser', () => {
  it('restores WSS only on the browser-generated .invalid Via', () => {
    const resp = [
      'SIP/2.0 200 OK',
      'Via: SIP/2.0/WS abc123.invalid;branch=z9hG4bK1;received=192.168.1.133',
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n');
    expect(toBrowser(resp)).toContain('Via: SIP/2.0/WSS abc123.invalid;branch=z9hG4bK1');
  });

  it('leaves FreeSWITCH-originated Via headers alone', () => {
    const invite = 'INVITE sip:x SIP/2.0\r\nVia: SIP/2.0/WS 192.168.1.133:5066;branch=z9\r\n\r\n';
    expect(toBrowser(invite)).toBe(invite);
  });

  it('is the inverse of toFreeSwitch for browser Via headers', () => {
    expect(toBrowser(toFreeSwitch(REGISTER))).toBe(REGISTER);
  });
});
