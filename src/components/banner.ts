import type { PhoneState } from '../types/phone';
import { el, setText, show } from './dom';

/** Error banner (dismissable) and notice banner (e.g. "Enable audio" for autoplay). */
export function createBanners(onDismissError: () => void, onEnableAudio: () => void) {
  const errorText = el('span', { 'data-testid': 'error-text' });
  const dismiss = el('button', { type: 'button', class: 'btn-link', 'aria-label': 'Dismiss' }, [
    '✕',
  ]);
  dismiss.addEventListener('click', onDismissError);
  const error = el('div', { class: 'banner banner-error', role: 'alert' }, [errorText, dismiss]);

  const noticeText = el('span');
  const enable = el('button', { type: 'button', class: 'btn btn-secondary' }, ['Enable audio']);
  enable.addEventListener('click', onEnableAudio);
  const notice = el('div', { class: 'banner banner-notice', role: 'status' }, [noticeText, enable]);

  const root = el('div', { class: 'banners' }, [error, notice]);

  function update(state: PhoneState): void {
    show(error, Boolean(state.error));
    setText(errorText, state.error ?? '');
    show(notice, Boolean(state.notice));
    setText(noticeText, state.notice ?? '');
  }

  return { root, update };
}
