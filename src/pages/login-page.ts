import { el } from '../components/dom';
import type { AppConfig } from '../config/config';
import type { Credentials, PhoneState } from '../types/phone';

/**
 * Login screen: extension, password, SIP domain and WSS server.
 * The password field is never pre-filled, never stored, and cleared after every attempt.
 */
export function createLoginPage(config: AppConfig, onSubmit: (c: Credentials) => void) {
  const field = (label: string, input: HTMLInputElement) =>
    el('label', { class: 'field' }, [label, input]);

  const extension = el('input', {
    name: 'extension',
    inputmode: 'numeric',
    autocomplete: 'username',
    required: true,
    'data-testid': 'login-extension',
  });
  const password = el('input', {
    name: 'password',
    type: 'password',
    autocomplete: 'off',
    required: true,
    'data-testid': 'login-password',
  });
  const domain = el('input', { name: 'domain', value: config.defaultDomain, required: true });
  const wss = el('input', { name: 'wss', value: config.defaultWssUrl, required: true });
  const submit = el(
    'button',
    { type: 'submit', class: 'btn btn-call', 'data-testid': 'login-submit' },
    ['Sign in'],
  );
  const error = el('p', { class: 'form-error', role: 'alert', 'data-testid': 'login-error' });

  const form = el('form', { class: 'card login', autocomplete: 'off' }, [
    el('h1', {}, ['FS-WebRTC']),
    el('p', { class: 'hint' }, ['Lab softphone – sign in with your SIP extension.']),
    field('Extension', extension),
    field('Password', password),
    el('details', { class: 'advanced' }, [
      el('summary', {}, ['Server settings']),
      field('SIP domain', domain),
      field('WSS server', wss),
    ]),
    error,
    submit,
  ]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const creds: Credentials = {
      extension: extension.value.trim(),
      password: password.value,
      domain: domain.value.trim(),
      wssUrl: wss.value.trim(),
    };
    password.value = '';
    onSubmit(creds);
  });

  function update(state: PhoneState): void {
    const busy = state.connection === 'connecting' || state.registration === 'registering';
    submit.disabled = busy;
    submit.textContent = busy ? 'Signing in…' : 'Sign in';
    error.textContent = state.error ?? '';
  }

  return { root: form, update };
}
