import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import { SpeechCapturePanel } from "@/features/speech/SpeechCapturePanel";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import {
  patchCognitiveRoutineResultById,
  saveCognitiveRoutineResult,
} from "@/features/cognitive/cognitiveRoutineStorage";
import { getSpeechLanguage } from "@/utils/localizedText";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";
import {
  getHaruConsent,
  subscribeToHaruConsent,
} from "@/features/profile/haruConsentStorage";
import {
  getHaruVoiceConsentError,
  hasHaruVoicePipelineConsent,
  useHaruConsent,
} from "@/features/profile/useHaruConsent";
import { enqueueSttJob } from "@/features/speech/sttJobQueue";

interface SpeechRepeatPracticeProps {
  prompt: string;
  phrase: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function SpeechRepeatPractice({
  prompt,
  phrase,
  onComplete,
  setGlobalState,
  globalState,
}: SpeechRepeatPracticeProps) {
  const { t, i18n } = useTranslation();
  const { speak } = useInteractionFeedback();
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const capture = useVoiceRecorder();
  const stopRecording = capture.stop;
  const consent = useHaruConsent();
  const speechConsentGranted = hasHaruVoicePipelineConsent(consent);
  const captureAuthorizedRef = useRef(speechConsentGranted);
  const consentRevisionRef = useRef(0);
  const recordingConsentRevisionRef = useRef<number | null>(
    speechConsentGranted ? 0 : null,
  );
  const pipelineConsentGrantedRef = useRef(speechConsentGranted);

  useEffect(() => {
    return subscribeToHaruConsent((nextConsent) => {
      const nextGranted = hasHaruVoicePipelineConsent(nextConsent);
      if (pipelineConsentGrantedRef.current && !nextGranted) {
        captureAuthorizedRef.current = false;
        consentRevisionRef.current += 1;
        recordingConsentRevisionRef.current = null;
        stopRecording();
      }
      pipelineConsentGrantedRef.current = nextGranted;
    });
  }, [stopRecording]);

  // Let the learner proceed at any time (speech is optional). We intentionally
  // do NOT auto-advance on save — the learner reviews feedback first, then
  // taps Continue (see SP-03).
  useEffect(() => {
    if (globalState === "awaiting_answer" || globalState === "answer_selected") {
      setGlobalState("answer_selected");
    }
  }, [globalState, setGlobalState]);

  const handlePlay = () => {
    // Explicit listen actions remain available independently of optional UI
    // effects and are a safe no-op where speechSynthesis is missing.
    speak(phrase, getSpeechLanguage(i18n.language));
    setIsPlaying(true);
    // speakCalmly cancels prior utterances and does not expose onend, so clear
    // the playing state shortly after as an approximation of the end.
    window.setTimeout(() => setIsPlaying(false), 1500);
  };

  const handleFinish = async () => {
    if (isTranscribing) return;
    setIsTranscribing(true);
    const consentAtFinish = getHaruConsent();
    const recordingConsentRevision = recordingConsentRevisionRef.current;
    const hadConsentAtFinish =
      captureAuthorizedRef.current &&
      recordingConsentRevision !== null &&
      hasHaruVoicePipelineConsent(consentAtFinish);
    const capturedBlob = hadConsentAtFinish ? await capture.stopAndGetBlob() : null;
    const consentAfterFinalization = getHaruConsent();
    const canRetainAudio =
      hadConsentAtFinish &&
      captureAuthorizedRef.current &&
      consentRevisionRef.current === recordingConsentRevision &&
      recordingConsentRevisionRef.current === recordingConsentRevision &&
      hasHaruVoicePipelineConsent(consentAfterFinalization);
    const blob = canRetainAudio ? capturedBlob : null;
    const hasAudio = Boolean(canRetainAudio && blob && blob.size > 0);
    const recognitionError = !canRetainAudio
      ? getHaruVoiceConsentError(consentAfterFinalization) ?? "voice-consent-required"
      : hasAudio
          ? "stt-pending"
          : capture.error ?? "recording-unavailable";
    setTranscript("");
    const routineResultId = saveCognitiveRoutineResult({
      type: "speech_repeat_practice",
      completed: true,
      metadata: {
        phrase,
        transcript: "",
        speechSupported: capture.isSupported,
        listeningDurationMs: canRetainAudio ? capture.getDurationMs() : 0,
        recognitionError,
        audioAssetUrl: canRetainAudio ? capture.audioAssetUrl : null,
        locale: i18n.language,
        inputMode: hasAudio ? "speech" : "skipped",
        sttStatus: hasAudio ? "pending" : "failed",
        sttNoSpeech: false,
        sttEngine: null,
        sttModel: null,
        sttModelRevision: null,
        sttAlignerModel: null,
        sttAlignerRevision: null,
        sttPreprocessingVersion: null,
        sttLanguage: null,
        sttConfidence: null,
        sttSegments: [],
        pronunciationSimilarity: null,
      },
    });

    if (hasAudio && blob && routineResultId) {
      const jobId = await enqueueSttJob(blob, {
        kind: "speech-repeat",
        routineResultId,
      });
      if (!jobId) {
        patchCognitiveRoutineResultById(routineResultId, {
          recognitionError: "stt-queue-failed",
          sttStatus: "failed",
        });
      }
    }

    // Feedback first; advancement happens when the learner taps Continue.
    setIsTranscribing(false);
    setGlobalState("correct_feedback");
  };

  // onComplete is referenced so the parent's state machine stays wired, but we
  // deliberately do not call it here — the feedback tray drives the next step.
  void onComplete;

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
          {t("exercise.cognitive.practice")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex flex-col items-center justify-center gap-6 py-4">
        <div className="text-3xl font-extrabold text-ink p-6 bg-primary-50 rounded-2xl border-2 border-primary-100 text-center leading-snug w-full shadow-sm">
          &ldquo;{phrase}&rdquo;
        </div>

        <button
          onClick={handlePlay}
          disabled={isPlaying}
          aria-label={t("exercise.cognitive.listen")}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-300 bg-white font-bold text-ink hover:bg-gray-50 transition active:scale-95 disabled:opacity-50 min-h-[56px]"
        >
          <Play size={20} className={isPlaying ? "text-primary-600" : ""} aria-hidden="true" />
          {t("exercise.cognitive.listen")}
        </button>
      </div>

      <SpeechCapturePanel
        isSupported={capture.isSupported && speechConsentGranted}
        isListening={capture.isRecording}
        onStart={() => {
          if (hasHaruVoicePipelineConsent(getHaruConsent())) {
            captureAuthorizedRef.current = true;
            recordingConsentRevisionRef.current = consentRevisionRef.current;
            capture.start();
          }
        }}
        onStop={capture.stop}
        startLabel={t("speech.start")}
        stopLabel={t("speech.stop")}
        listeningTitle={t("speech.listeningTitle")}
        listeningBody={t("speech.listeningBody")}
        unsupportedNote={
          speechConsentGranted ? t("speech.unsupported") : t("speech.consentRequired")
        }
        durationHint={t("speech.durationHint")}
        levels={capture.levels}
      />

      {transcript && (
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-gray-500">{t("speech.recognized")}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{transcript}</p>
        </div>
      )}

      <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
        <Button3D
          variant={isTranscribing ? "disabled" : "primary"}
          feedbackCue={
            capture.isRecording || capture.isFinalizing ? "none" : "confirm"
          }
          fullWidth
          onClick={handleFinish}
        >
          {isTranscribing ? t("speech.transcribing") : t("exercise.cognitive.doneSpeaking")}
        </Button3D>
      </div>
    </div>
  );
}
