import type { PhoneState } from '../types/phone';
import { el } from './dom';

const KEYS: Array<[string, string]> = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

export interface DialpadHandlers {
  onCall(number: string): void;
  onDtmf(tone: string): void;
}

/**
 * Number entry + keypad. With no active call keys type into the number field;
 * during an active call keys send DTMF tones.
 */
export function createDialpad(handlers: DialpadHandlers) {
  const input = el('input', {
    type: 'tel',
    class: 'dial-input',
    placeholder: 'Enter number',
    'aria-label': 'Number to call',
    maxlength: '40',
    autocomplete: 'off',
    'data-testid': 'dial-input',
  });
  const callButton = el(
    'button',
    { type: 'submit', class: 'btn btn-call', 'data-testid': 'call' },
    ['Call'],
  );
  const backspace = el(
    'button',
    { type: 'button', class: 'btn btn-secondary', 'aria-label': 'Delete' },
    ['⌫'],
  );
  const dtmfEcho = el('div', { class: 'dtmf-echo', 'aria-live': 'polite' });

  let inCall = false;

  const keys = KEYS.map(([digit, letters]) => {
    const key = el('button', { type: 'button', class: 'key', 'data-key': digit }, [
      el('span', { class: 'digit' }, [digit]),
      el('span', { class: 'letters' }, [letters]),
    ]);
    key.addEventListener('click', () => press(digit));
    return key;
  });

  function press(digit: string): void {
    if (inCall) {
      dtmfEcho.textContent = (dtmfEcho.textContent + digit).slice(-20);
      handlers.onDtmf(digit);
    } else {
      input.value += digit;
      input.focus();
    }
  }

  backspace.addEventListener('click', () => {
    input.value = input.value.slice(0, -1);
  });

  const form = el('form', { class: 'dial-form' }, [
    el('div', { class: 'dial-row' }, [input, backspace]),
    el('div', { class: 'keypad' }, keys),
    dtmfEcho,
    callButton,
  ]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!inCall) handlers.onCall(input.value);
  });

  // Physical keyboard during a call sends DTMF.
  document.addEventListener('keydown', (e) => {
    if (!inCall || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      return;
    }
    if (/^[0-9*#]$/.test(e.key)) press(e.key);
  });

  function update(state: PhoneState): void {
    const active = state.call?.status === 'active';
    if (active !== inCall) {
      inCall = active;
      dtmfEcho.textContent = '';
    }
    const busy = state.call !== undefined && state.call.status !== 'ended';
    callButton.hidden = busy;
    callButton.disabled = state.registration !== 'registered';
    input.disabled = busy;
    backspace.disabled = busy;
    form.classList.toggle('in-call', inCall);
  }

  return { root: form, update };
}
