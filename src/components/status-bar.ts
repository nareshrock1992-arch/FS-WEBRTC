import type { PhoneState } from '../types/phone';
import { el, setText } from './dom';

const CONNECTION_LABEL: Record<PhoneState['connection'], string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
};

const REGISTRATION_LABEL: Record<PhoneState['registration'], string> = {
  unregistered: 'Not registered',
  registering: 'Registering…',
  registered: 'Registered',
  failed: 'Registration failed',
};

/** Shows signed-in identity, WSS connection state, SIP registration state and Logout. */
export function createStatusBar(onLogout: () => void) {
  const identity = el('span', { class: 'identity' });
  const connection = el('span', { class: 'pill', 'data-testid': 'connection-status' });
  const registration = el('span', { class: 'pill', 'data-testid': 'registration-status' });
  const logout = el('button', { type: 'button', class: 'btn btn-secondary' }, ['Log out']);
  logout.addEventListener('click', onLogout);

  const root = el('header', { class: 'status-bar' }, [
    el('div', { class: 'identity-block' }, [identity]),
    el('div', { class: 'pills' }, [connection, registration]),
    logout,
  ]);

  function update(state: PhoneState): void {
    setText(
      identity,
      state.account ? `Ext ${state.account.extension}@${state.account.domain}` : '',
    );
    let conn = CONNECTION_LABEL[state.connection];
    if (state.connection === 'reconnecting') conn += ` (attempt ${state.reconnectAttempt})`;
    if (!state.online) conn = 'Offline';
    setText(connection, conn);
    connection.dataset.state = state.online ? state.connection : 'offline';
    setText(registration, REGISTRATION_LABEL[state.registration]);
    registration.dataset.state = state.registration;
  }

  return { root, update };
}
