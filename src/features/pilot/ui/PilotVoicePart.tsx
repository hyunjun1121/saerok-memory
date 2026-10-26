import { useEffect, useRef, useState } from 'react';
import { Button3D } from '@/components/Button3D';
import { useVoiceRecorder } from '@/features/speech/useVoiceRecorder';
import { VoiceWaveform } from '@/features/speech/VoiceWaveform';
import { PILOT_COPY } from '@/features/pilot/pilotProtocol';
import type { PilotTake } from '@/features/pilot/pilotStorage';
import { stopPilotNarration } from '@/features/pilot/pilotNarration';
import { getLocalizedText, type SupportedLanguage } from '@/utils/localizedText';
import { usePilotButtons } from '@/features/pilot/usePilotButtons';
import { PilotRecordingDelivery } from '@/features/pilot/pilotRecording';
import type { PilotPart } from '@/features/pilot/pilotStorage';
import { useCallback } from 'react';

interface Props {
  sessionId: string;
  questionId: string;
  part: PilotPart;
  language: SupportedLanguage;
  savedTake?: PilotTake;
  blocked: boolean;
  onTake: (take: PilotTake) => Promise<boolean>;
  onNext: () => void;
  onReplay: () => void;
  onSkip: () => void;
  onEvent: (type: string, detail?: Record<string, unknown>) => void;
}

export function PilotVoicePart({ sessionId, questionId, part, language, savedTake, blocked, onTake, onNext, onReplay, onSkip, onEvent }: Props) {
  const delivery = useRef<PilotRecordingDelivery | null>(null);
  const audioChunk = useCallback((chunk: Blob) => delivery.current?.chunk(chunk), []);
  const recordingStarted = useCallback((startedAt: string) => onEvent('recording_start', {
    recordingId: delivery.current?.recordingId, actualStartedAt: startedAt,
  }), [onEvent]);
  const recorder = useVoiceRecorder(60_000, { telemetryEnabled: false, onAudioChunk: audioChunk, onRecordingStarted: recordingStarted });
  const [take, setTake] = useState<PilotTake | null>(savedTake ?? null);
  const [started, setStarted] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioElement = useRef<HTMLAudioElement>(null);
  const finishing = useRef(false);
  const c = (key: keyof typeof PILOT_COPY) => getLocalizedText(PILOT_COPY[key], language);

  useEffect(() => {
    if (!take) return;
    const url = URL.createObjectURL(take.blob);
    if (audioElement.current) audioElement.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [take]);

  const start = async () => {
    if (blocked || working || finishing.current) return;
    stopPilotNarration();
    audioElement.current?.pause();
    setWorking(true);
    try {
      const nextDelivery = new PilotRecordingDelivery(sessionId, questionId, part);
      await nextDelivery.start();
      delivery.current = nextDelivery;
      onEvent(take ? 'recording_retry' : 'recording_requested', { recordingId: nextDelivery.recordingId });
      setTake(null);
      setFailed(false);
      setStarted(true);
      recorder.start();
    } catch {
      window.dispatchEvent(new Event('haru:pilot-delivery-error'));
    } finally { setWorking(false); }
  };

  const storeTake = async (nextTake: PilotTake) => {
    try {
      await delivery.current?.finish(nextTake);
      const saved = await onTake(nextTake);
      if (saved) onEvent('recording_saved', { recordingId: nextTake.recordingId, durationMs: nextTake.durationMs, bytes: nextTake.blob.size, mimeType: nextTake.mimeType });
    } catch { window.dispatchEvent(new Event('haru:pilot-delivery-error')); }
  };

  const finish = async () => {
    if (working || finishing.current) return;
    finishing.current = true;
    setWorking(true);
    try {
      const artifact = await recorder.stopAndFinalize();
      setStarted(false);
      if (!artifact?.blob.size) {
        onEvent('recording_error', { recordingId: delivery.current?.recordingId, reason: recorder.error ?? 'empty_audio' });
        setFailed(true); return;
      }
      const nextTake: PilotTake = {
        blob: artifact.blob, mimeType: artifact.mimeType,
        durationMs: artifact.durationMs, startedAt: artifact.startedAt, endedAt: artifact.endedAt,
        recordingId: delivery.current?.recordingId,
        sampleRateHz: artifact.sampleRateHz, channelCount: artifact.channelCount,
      };
      setTake(nextTake);
      onEvent('recording_stop', { recordingId: nextTake.recordingId, durationMs: nextTake.durationMs });
      await storeTake(nextTake);
    } finally {
      finishing.current = false;
      setWorking(false);
    }
  };

  const primary = () => {
    if (working || (blocked && !started)) return;
    if (take && savedTake) onNext();
    else if (take) void storeTake(take);
    else if (started && !recorder.error) void finish();
    else void start();
  };
  const secondary = () => {
    if (blocked || working || (started && !recorder.error)) return;
    if (take || failed || recorder.error) void start();
    else onReplay();
  };
  usePilotButtons((index) => { if (index % 2 === 0) secondary(); else primary(); }, (!blocked || started) && !working);

  const error = failed || recorder.error || !recorder.isSupported;
  return (
    <section className="flex flex-col gap-5" data-testid="pilot-voice-part">
      <div className={`rounded-3xl border-4 p-5 ${recorder.isRecording ? 'border-red-500 bg-red-50' : 'border-primary-200 bg-primary-50'}`}>
        <p className="text-center text-xl font-bold" role="status">
          {working || recorder.isFinalizing ? c('saving') : recorder.isRecording ? c('listening') : take ? c('savedTake') : started && recorder.audioAssetUrl ? c('recordingEnded') : c('voiceGuide')}
        </p>
        <VoiceWaveform levels={recorder.levels} active={recorder.isRecording} ariaLabel={recorder.isRecording ? c('listening') : c('voiceGuide')} />
        <p className="text-center text-base">{c('recordingLimit')}</p>
      </div>
      {error && <p role="alert" className="text-lg font-bold text-red-800">{c('micError')}</p>}
      {take && <audio ref={audioElement} className="w-full" controls aria-label={c('savedTake')}
        onPlay={() => onEvent('audio_preview_started', { recordingId: take.recordingId })}
        onPause={() => onEvent('audio_preview_paused', { recordingId: take.recordingId })} />}
      <div className="grid grid-cols-2 gap-4">
        <Button3D variant="secondary" disabled={blocked || working || (started && !error)} feedbackCue="none" onClick={secondary}>
          {take || error ? c('retry') : c('replay')}
        </Button3D>
        <Button3D disabled={(blocked && !started) || working || recorder.isFinalizing} feedbackCue="none" onClick={primary}>
          {take ? c('next') : started && !recorder.error ? c('stop') : c('record')}
        </Button3D>
      </div>
      <p className="text-center text-base text-gray-600">{c('left')} · {c('right')}</p>
      <button type="button" className="min-h-[60px] rounded-xl border-2 border-gray-300 px-4 text-lg underline" disabled={blocked || working || (started && !error)} onClick={onSkip}>{c('skip')}</button>
    </section>
  );
}
