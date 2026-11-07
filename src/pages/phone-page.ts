import { createBanners } from '../components/banner';
import { createCallPanel } from '../components/call-panel';
import { createDevicePicker } from '../components/device-picker';
import { createDialpad } from '../components/dialpad';
import { el } from '../components/dom';
import { createStatusBar } from '../components/status-bar';
import type { PhoneService } from '../services/phone-service';
import type { PhoneState } from '../types/phone';

/** Main softphone screen, composed of independent components. */
export function createPhonePage(phone: PhoneService) {
  const statusBar = createStatusBar(() => void phone.logout());
  const banners = createBanners(
    () => phone.clearError(),
    () => void phone.unlockAudio(),
  );
  const callPanel = createCallPanel({
    onAnswer: () => void phone.answer(),
    onReject: () => void phone.reject(),
    onHangup: () => void phone.hangup(),
    onMute: () => phone.toggleMute(),
    onHold: () => void phone.toggleHold(),
  });
  const dialpad = createDialpad({
    onCall: (n) => void phone.dial(n),
    onDtmf: (t) => void phone.sendDtmf(t),
  });
  const devices = createDevicePicker({
    onInput: (id) => void phone.selectInput(id),
    onOutput: (id) => void phone.selectOutput(id),
  });

  const root = el('div', { class: 'card phone' }, [
    statusBar.root,
    banners.root,
    callPanel.root,
    dialpad.root,
    devices.root,
  ]);

  function update(state: PhoneState): void {
    statusBar.update(state);
    banners.update(state);
    callPanel.update(state);
    dialpad.update(state);
    devices.update(state);
  }

  return { root, update };
}
