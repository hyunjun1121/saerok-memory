import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playPilotNarration, stopPilotNarration } from '@/features/pilot/pilotNarration';

class Utterance {
  text: string;
  lang = '';
  rate = 1;
  voice: unknown;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(text: string) { this.text = text; }
}

describe('pilot narration outcomes', () => {
  const speak = vi.fn<(utterance: Utterance) => void>();
  const cancel = vi.fn();
  const utterance = () => speak.mock.calls.at(-1)![0];

  beforeEach(() => {
    speak.mockReset(); cancel.mockReset();
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices: () => [] });
  });
  afterEach(() => { stopPilotNarration(); vi.unstubAllGlobals(); });

  it('reports a completed utterance', async () => {
    const result = playPilotNarration('こんにちは。', 'ja');
    expect(utterance().lang).toBe('ja-JP');
    utterance().onend?.();
    await expect(result).resolves.toBe('finished');
  });

  it.each(['canceled', 'interrupted'])('recognizes the browser %s event as cancellation', async (error) => {
    const result = playPilotNarration('こんにちは。', 'ja');
    utterance().onerror?.({ error });
    await expect(result).resolves.toBe('cancelled');
  });

  it('settles intentional cancellation even when the browser sends no event', async () => {
    const result = playPilotNarration('こんにちは。', 'ja');
    stopPilotNarration();
    await expect(result).resolves.toBe('cancelled');
  });

  it('keeps a newer narration active when an older browser event arrives late', async () => {
    const old = playPilotNarration('前の質問です。', 'ja');
    const previous = utterance();
    const current = playPilotNarration('次の質問です。', 'ja');
    previous.onerror?.({ error: 'interrupted' });
    await expect(old).resolves.toBe('cancelled');
    utterance().onend?.();
    await expect(current).resolves.toBe('finished');
  });

  it('reports an actual synthesis failure', async () => {
    const result = playPilotNarration('こんにちは。', 'ja');
    utterance().onerror?.({ error: 'synthesis-unavailable' });
    await expect(result).resolves.toBe('unavailable');
  });
});
