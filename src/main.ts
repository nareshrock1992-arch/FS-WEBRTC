import './styles/app.css';
import { loadConfig } from './config/config';
import { createLoginPage } from './pages/login-page';
import { createPhonePage } from './pages/phone-page';
import { PhoneService } from './services/phone-service';
import type { PhoneState } from './types/phone';

/** Application bootstrap: picks the login or phone page from the current state. */
function start(): void {
  const app = document.getElementById('app');
  if (!app) return;

  if (!window.isSecureContext) {
    app.textContent =
      'This page must be opened over HTTPS (or http://localhost). Browsers block the microphone otherwise.';
    return;
  }

  const config = loadConfig();
  const phone = new PhoneService(config);
  const login = createLoginPage(config, (creds) => void phone.login(creds));
  const phonePage = createPhonePage(phone);

  const showPhone = (s: PhoneState) =>
    s.account !== undefined && (s.connection !== 'connecting' || s.registration !== 'unregistered');

  const render = (state: PhoneState) => {
    const page = showPhone(state) ? phonePage : login;
    if (app.firstElementChild !== page.root) app.replaceChildren(page.root);
    page.update(state);
  };

  phone.store.subscribe(render);
  render(phone.store.get());
}

start();
