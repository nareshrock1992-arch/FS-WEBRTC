import type { PhoneState } from '../types/phone';
import { el, setOptions, show } from './dom';

export interface DevicePickerHandlers {
  onInput(deviceId: string): void;
  onOutput(deviceId: string): void;
}

/** Microphone and speaker selection. Speaker choice is hidden where setSinkId is unsupported. */
export function createDevicePicker(h: DevicePickerHandlers) {
  const mic = el('select', { 'aria-label': 'Microphone', 'data-testid': 'mic-select' });
  const speaker = el('select', { 'aria-label': 'Speaker', 'data-testid': 'speaker-select' });
  const speakerRow = el('label', { class: 'field' }, ['Speaker', speaker]);
  const unsupported = el('p', { class: 'hint' }, [
    'Speaker selection is not supported by this browser; the system default is used.',
  ]);

  mic.addEventListener('change', () => h.onInput(mic.value));
  speaker.addEventListener('change', () => h.onOutput(speaker.value));

  const root = el('details', { class: 'devices' }, [
    el('summary', {}, ['Audio devices']),
    el('label', { class: 'field' }, ['Microphone', mic]),
    speakerRow,
    unsupported,
  ]);

  function update(state: PhoneState): void {
    const d = state.devices;
    const withDefault = (list: { deviceId: string; label: string }[]) => [
      { value: '', label: 'System default' },
      ...list
        .filter((x) => x.deviceId !== 'default' && x.deviceId !== '')
        .map((x) => ({ value: x.deviceId, label: x.label })),
    ];
    setOptions(mic, withDefault(d.inputs), d.selectedInput);
    setOptions(speaker, withDefault(d.outputs), d.selectedOutput);
    show(speakerRow, d.sinkSupported);
    show(unsupported, !d.sinkSupported);
  }

  return { root, update };
}
