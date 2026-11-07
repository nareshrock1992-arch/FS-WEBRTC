import type { CallInfo, PhoneState } from '../types/phone';
import { formatDuration } from '../utils/time';
import { el, setText, show } from './dom';

export interface CallPanelHandlers {
  onAnswer(): void;
  onReject(): void;
  onHangup(): void;
  onMute(): void;
  onHold(): void;
}

const STATUS_LABEL: Record<CallInfo['status'], string> = {
  dialing: 'Calling…',
  'ringing-out': 'Ringing…',
  'ringing-in': 'Incoming call',
  connecting: 'Connecting…',
  active: 'In call',
  ended: 'Call ended',
};

/** Shows the current call: remote party, state, timer and call-control buttons. */
export function createCallPanel(h: CallPanelHandlers) {
  const remote = el('div', { class: 'call-remote', 'data-testid': 'call-remote' });
  const status = el('div', { class: 'call-status', 'data-testid': 'call-status' });
  const timer = el('div', { class: 'call-timer', 'data-testid': 'call-timer' });

  const button = (label: string, cls: string, testid: string, fn: () => void) => {
    const b = el('button', { type: 'button', class: `btn ${cls}`, 'data-testid': testid }, [label]);
    b.addEventListener('click', fn);
    return b;
  };
  const answer = button('Answer', 'btn-call', 'answer', h.onAnswer);
  const reject = button('Reject', 'btn-danger', 'reject', h.onReject);
  const mute = button('Mute', 'btn-secondary', 'mute', h.onMute);
  const hold = button('Hold', 'btn-secondary', 'hold', h.onHold);
  const hangup = button('Hang up', 'btn-danger', 'hangup', h.onHangup);

  const root = el('section', { class: 'call-panel', 'aria-live': 'polite' }, [
    remote,
    status,
    timer,
    el('div', { class: 'call-actions' }, [answer, reject, mute, hold, hangup]),
  ]);

  let call: CallInfo | undefined;
  setInterval(() => renderTimer(), 1000);

  function renderTimer(): void {
    setText(
      timer,
      call?.status === 'active' && call.answeredAt
        ? formatDuration(Date.now() - call.answeredAt)
        : '',
    );
  }

  function update(state: PhoneState): void {
    call = state.call;
    show(root, call !== undefined);
    if (!call) return;
    root.dataset.status = call.status;
    setText(remote, `${call.direction === 'inbound' ? 'From' : 'To'}: ${call.remoteIdentity}`);
    let label = STATUS_LABEL[call.status];
    if (call.status === 'active' && call.held) label = 'On hold';
    if (call.status === 'ended' && call.endReason) label = `Call ended – ${call.endReason}`;
    setText(status, label);
    renderTimer();

    const ringingIn = call.status === 'ringing-in';
    const active = call.status === 'active';
    const ended = call.status === 'ended';
    show(answer, ringingIn);
    show(reject, ringingIn);
    show(mute, active);
    show(hold, active);
    show(hangup, !ringingIn && !ended);
    setText(mute, call.muted ? 'Unmute' : 'Mute');
    mute.setAttribute('aria-pressed', String(call.muted));
    setText(hold, call.held ? 'Resume' : 'Hold');
    hold.setAttribute('aria-pressed', String(call.held));
  }

  return { root, update };
}
