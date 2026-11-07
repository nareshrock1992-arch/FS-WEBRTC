/**
 * Via-header transport rewriting for the WSS -> WS proxy.
 *
 * Why: the browser speaks SIP over wss://, so SIP.js puts "SIP/2.0/WSS" in its Via header.
 * The proxy hands the message to FreeSWITCH over a plain ws:// connection, and FreeSWITCH's
 * SIP stack silently discards requests whose Via transport (WSS) does not match the
 * connection transport (WS). Verified on 2026-11-07: REGISTER over the raw pipe got no reply;
 * the same REGISTER with Via WS got 200 OK.
 *
 * Rules (applied only to Via headers, never to bodies):
 *  - browser -> FreeSWITCH: every "SIP/2.0/WSS" Via becomes "SIP/2.0/WS"
 *  - FreeSWITCH -> browser: Via headers whose sent-by host ends in ".invalid" (the random host
 *    SIP.js generates for itself) are turned back into "SIP/2.0/WSS", so the browser sees
 *    exactly the Via it sent. FreeSWITCH's own Via headers are left untouched.
 */

/** Splits a SIP message into header block and body (body untouched). */
function splitMessage(msg) {
  const idx = msg.indexOf('\r\n\r\n');
  return idx === -1 ? [msg, ''] : [msg.slice(0, idx), msg.slice(idx)];
}

const VIA_LINE = /^(via|v)(\s*:\s*)(.*)$/gim;

export function toFreeSwitch(msg) {
  const [head, body] = splitMessage(msg);
  const out = head.replace(
    VIA_LINE,
    (_m, name, sep, value) =>
      `${name}${sep}${value.replace(/SIP\s*\/\s*2\.0\s*\/\s*WSS\b/gi, 'SIP/2.0/WS')}`,
  );
  return out + body;
}

export function toBrowser(msg) {
  const [head, body] = splitMessage(msg);
  const out = head.replace(
    VIA_LINE,
    (_m, name, sep, value) =>
      `${name}${sep}${value.replace(
        /SIP\s*\/\s*2\.0\s*\/\s*WS(\s+[A-Za-z0-9.-]+\.invalid\b)/gi,
        'SIP/2.0/WSS$1',
      )}`,
  );
  return out + body;
}
