import { getSpeechLanguage, type SupportedLanguage } from '@/utils/localizedText';

export type PilotNarrationResult = 'finished' | 'cancelled' | 'unavailable';
let settleActiveNarration: ((result: PilotNarrationResult) => void) | null = null;

export function stopPilotNarration(): void {
  settleActiveNarration?.('cancelled');
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

export function playPilotNarration(text: string, language: SupportedLanguage): Promise<PilotNarrationResult> {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve('unavailable');
  stopPilotNarration();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PilotNarrationResult) => {
      if (settled) return;
      settled = true;
      if (settleActiveNarration === finish) settleActiveNarration = null;
      resolve(result);
    };
    settleActiveNarration = finish;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLanguage(language);
    utterance.rate = 0.85;
    const voice = speechSynthesis.getVoices().find((item) => item.lang.startsWith(language));
    if (voice) utterance.voice = voice;
    utterance.onend = () => finish('finished');
    utterance.onerror = (event) => finish(event.error === 'canceled' || event.error === 'interrupted' ? 'cancelled' : 'unavailable');
    try { speechSynthesis.speak(utterance); } catch { finish('unavailable'); }
  });
}
