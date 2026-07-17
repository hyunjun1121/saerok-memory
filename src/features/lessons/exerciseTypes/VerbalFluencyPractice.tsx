import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { SpeechCapturePanel } from "@/features/speech/SpeechCapturePanel";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";
import {
  patchCognitiveRoutineResultById,
  saveCognitiveRoutineResult,
} from "@/features/cognitive/cognitiveRoutineStorage";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
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

interface VerbalFluencyPracticeProps {
  prompt: string;
  category: string;
  durationSeconds: number;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

// Voice-only: the learner just talks into the mic (reactive waveform confirms
// capture). No text box, no word list, no countdown — speak, then finish. The
// topic card gives the cue. Recorded as a non-diagnostic routine entry; the
// audio asset + duration are kept for later (backend) STT.
export function VerbalFluencyPractice({
  prompt,
  category,
  durationSeconds,
  onComplete,
  setGlobalState,
  globalState,
}: VerbalFluencyPracticeProps) {
  const { t } = useTranslation();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const capture = useVoiceRecorder(durationSeconds * 1000);
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

  useEffect(() => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") {
      return;
    }
    setGlobalState(capture.isRecording ? "answer_selected" : "awaiting_answer");
  }, [capture.isRecording, globalState, setGlobalState]);

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

    const routineResultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: {
        category,
        durationSeconds,
        transcript: "",
        entries: [],
        uniqueCount: 0,
        repetitionCount: 0,
        inputMode: hasAudio ? "speech" : "skipped",
        speechSupported: capture.isSupported,
        speechDurationMs: canRetainAudio ? capture.getDurationMs() : 0,
        audioAssetUrl: canRetainAudio ? capture.audioAssetUrl : null,
        recognitionError,
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
      },
    });

    if (hasAudio && blob && routineResultId) {
      const jobId = await enqueueSttJob(blob, {
        kind: "verbal-fluency",
        routineResultId,
      });
      if (!jobId) {
        patchCognitiveRoutineResultById(routineResultId, {
          recognitionError: "stt-queue-failed",
          sttStatus: "failed",
        });
      }
    }

    setIsTranscribing(false);
    setGlobalState("correct_feedback");
    onComplete();
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.cognitive.verbalFluency")}
        </span>
        <h2 className="text-4xl font-extrabold leading-snug text-ink">{prompt}</h2>
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
        levels={capture.levels}
      />

      <div className="fixed bottom-[96px] left-0 right-0 z-30 mx-auto max-w-md px-4">
        <Button3D
          variant={isTranscribing ? "disabled" : "primary"}
          fullWidth
          onClick={handleFinish}
        >
          {isTranscribing ? t("speech.transcribing") : t("exercise.cognitive.finishFluency")}
        </Button3D>
      </div>
    </div>
  );
}
