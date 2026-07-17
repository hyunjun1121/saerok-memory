import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpeechRepeatPractice } from '@/features/lessons/exerciseTypes/SpeechRepeatPractice';
import { getCognitiveRoutineResults, clearCognitiveRoutineResults } from '@/features/cognitive/cognitiveRoutineStorage';
import { HARU_DEMO_PERSONA } from '@/data/haru7DayExercises';
import '@/i18n';

const mocks = vi.hoisted(() => ({
  transcribe: vi.fn(),
  recorder: {
    isSupported: false,
    isRecording: false,
    isFinalizing: false,
    levels: [] as number[],
    durationMs: 0,
    audioAssetUrl: null as string | null,
    error: null as string | null,
    start: vi.fn(),
    stop: vi.fn(),
    getDurationMs: vi.fn(() => 0),
    stopAndGetBlob: vi.fn<() => Promise<Blob | null>>(() => Promise.resolve(null)),
  },
}));

vi.mock('@/features/speech/useVoiceRecorder', () => ({
  useVoiceRecorder: () => mocks.recorder,
}));

vi.mock('@/features/speech/stt', () => ({
  transcribeStory: mocks.transcribe,
  formatSttEngine: (result: { modelRevision: string }) =>
    `qwen3-asr:Qwen/Qwen3-ASR-1.7B@${result.modelRevision}`,
}));

function setConsent(key: 'voiceRecording' | 'sttProcessing', value: boolean): void {
  Object.defineProperty(HARU_DEMO_PERSONA.consents, key, {
    configurable: true,
    writable: true,
    value,
  });
}

describe('SpeechRepeatPractice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearCognitiveRoutineResults();
    mocks.transcribe.mockReset();
    mocks.recorder.isSupported = false;
    mocks.recorder.getDurationMs.mockReturnValue(0);
    mocks.recorder.stopAndGetBlob.mockResolvedValue(null);
    setConsent('voiceRecording', true);
    setConsent('sttProcessing', true);

    // Mock speech APIs as unavailable for this test
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      writable: true,
    });
  });

  it('renders and completes even when speech APIs are unavailable', async () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
      <SpeechRepeatPractice
        prompt="Speak"
        phrase="Test phrase"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    // Set immediately to answer_selected so the learner can proceed anytime
    expect(setGlobalState).toHaveBeenCalledWith('answer_selected');

    fireEvent.click(screen.getByRole('button', { name: '다 말했습니다' }));

    await waitFor(() =>
      expect(setGlobalState).toHaveBeenCalledWith('correct_feedback'),
    );
    // SP-03: finishing must show feedback first and must NOT auto-advance.
    // The parent advances only when the learner taps Continue.
    expect(onComplete).not.toHaveBeenCalled();

    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));
    const results = getCognitiveRoutineResults();
    expect(results[0].type).toBe('speech_repeat_practice');
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        phrase: 'Test phrase',
        speechSupported: false,
        inputMode: 'skipped',
      }),
    );
  });

  it('stores Qwen transcript and engine metadata for recorded speech', async () => {
    mocks.recorder.isSupported = true;
    mocks.recorder.getDurationMs.mockReturnValue(3200);
    mocks.recorder.stopAndGetBlob.mockResolvedValue(
      new Blob(['voice'], { type: 'audio/webm' }),
    );
    mocks.transcribe.mockResolvedValue({
      text: '테스트 문장',
      noSpeech: false,
      language: 'ko-KR',
      durationSec: 3.2,
      confidence: null,
      engine: 'qwen3-asr',
      model: 'Qwen/Qwen3-ASR-1.7B',
      modelRevision: 'revision',
      alignerModel: 'Qwen/Qwen3-ForcedAligner-0.6B',
      alignerRevision: 'aligner-revision',
      preprocessingVersion: 'haru-dc-hp80-rms-v1',
      segments: [{ id: 0, start: 0, end: 1, text: '테스트' }],
    });

    render(
      <SpeechRepeatPractice
        prompt="따라 말해보세요"
        phrase="테스트 문장"
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '다 말했습니다' }));

    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));
    expect(mocks.transcribe).toHaveBeenCalledTimes(1);
    const result = getCognitiveRoutineResults()[0];
    expect(result.metadata).toEqual(
      expect.objectContaining({
        transcript: '테스트 문장',
        sttStatus: 'completed',
        sttConfidence: null,
        sttEngine: 'qwen3-asr:Qwen/Qwen3-ASR-1.7B@revision',
        sttModel: 'Qwen/Qwen3-ASR-1.7B',
        sttModelRevision: 'revision',
        sttAlignerRevision: 'aligner-revision',
        sttPreprocessingVersion: 'haru-dc-hp80-rms-v1',
      }),
    );
  });

  it('does not persist Qwen filler when the backend reports no speech', async () => {
    mocks.recorder.isSupported = true;
    mocks.recorder.stopAndGetBlob.mockResolvedValue(
      new Blob(['silence'], { type: 'audio/webm' }),
    );
    mocks.transcribe.mockResolvedValue({
      text: '그러니까.',
      noSpeech: true,
      language: 'ko-KR',
      durationSec: 30,
      confidence: null,
      engine: 'qwen3-asr',
      model: 'Qwen/Qwen3-ASR-1.7B',
      modelRevision: 'revision',
      alignerModel: 'Qwen/Qwen3-ForcedAligner-0.6B',
      alignerRevision: 'aligner-revision',
      preprocessingVersion: 'haru-dc-hp80-rms-v1',
      segments: [{ id: 0, start: 0, end: 0.2, text: '그러니까' }],
    });
    render(
      <SpeechRepeatPractice
        prompt="따라 말해보세요"
        phrase="테스트 문장"
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다 말했습니다' }));
    await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));

    const metadata = getCognitiveRoutineResults()[0].metadata;
    expect(metadata).toEqual(
      expect.objectContaining({
        transcript: '',
        inputMode: 'skipped',
        sttStatus: 'failed',
        sttNoSpeech: true,
        recognitionError: 'no-speech',
        sttSegments: [],
        pronunciationSimilarity: null,
      }),
    );
    expect(JSON.stringify(metadata)).not.toContain('그러니까');
  });

  it.each(['voiceRecording', 'sttProcessing'] as const)(
    'blocks mic and Qwen when %s consent is absent',
    async (key) => {
      setConsent(key, false);
      mocks.recorder.isSupported = true;
      render(
        <SpeechRepeatPractice
          prompt="따라 말해보세요"
          phrase="테스트 문장"
          onComplete={vi.fn()}
          setGlobalState={vi.fn()}
          globalState="awaiting_answer"
        />,
      );

      expect(
        screen.getByText('음성 기록과 글 변환에 동의한 뒤 이용할 수 있어요.'),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다 말했습니다' }));
      await waitFor(() => expect(getCognitiveRoutineResults()).toHaveLength(1));

      expect(mocks.recorder.start).not.toHaveBeenCalled();
      expect(mocks.recorder.stopAndGetBlob).not.toHaveBeenCalled();
      expect(mocks.transcribe).not.toHaveBeenCalled();
      expect(getCognitiveRoutineResults()[0].metadata?.transcript).toBe('');
    },
  );
});
