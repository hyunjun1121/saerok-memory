import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { HARU_DEMO_PERSONA } from "@/data/haru7DayExercises";
import { SpeechCapturePanel } from "@/features/speech/SpeechCapturePanel";
import { formatSttEngine, transcribeStory } from "@/features/speech/stt";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

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
  const voiceRecordingConsented = HARU_DEMO_PERSONA.consents.voiceRecording;
  const sttProcessingConsented = HARU_DEMO_PERSONA.consents.sttProcessing;
  const speechConsentGranted = voiceRecordingConsented && sttProcessingConsented;

  useEffect(() => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") {
      return;
    }
    setGlobalState(capture.isRecording ? "answer_selected" : "awaiting_answer");
  }, [capture.isRecording, globalState, setGlobalState]);

  const handleFinish = async () => {
    if (isTranscribing) return;
    setIsTranscribing(true);
    const blob = speechConsentGranted ? await capture.stopAndGetBlob() : null;
    const result = blob && blob.size > 0 ? await transcribeStory(blob) : null;
    const transcript = result && !result.noSpeech ? result.text : "";
    const recognitionError = !voiceRecordingConsented
      ? "voice-consent-required"
      : !sttProcessingConsented
        ? "stt-consent-required"
        : result?.noSpeech
          ? "no-speech"
          : capture.error ?? (blob && !result ? "transcribe-failed" : null);
    const entries = transcript
      .split(/[\s,，、]+/u)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const uniqueCount = new Set(entries).size;

    saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: {
        category,
        durationSeconds,
        transcript,
        entries,
        uniqueCount,
        repetitionCount: Math.max(0, entries.length - uniqueCount),
        inputMode: transcript ? "speech" : "skipped",
        speechSupported: capture.isSupported,
        speechDurationMs: capture.getDurationMs(),
        audioAssetUrl: speechConsentGranted ? capture.audioAssetUrl : null,
        recognitionError,
        sttStatus: transcript ? "completed" : "failed",
        sttNoSpeech: result?.noSpeech ?? false,
        sttEngine: result ? formatSttEngine(result) : null,
        sttModel: result?.model ?? null,
        sttModelRevision: result?.modelRevision ?? null,
        sttAlignerModel: result?.alignerModel ?? null,
        sttAlignerRevision: result?.alignerRevision ?? null,
        sttPreprocessingVersion: result?.preprocessingVersion ?? null,
        sttLanguage: result?.language ?? null,
        sttConfidence: result?.confidence ?? null,
        sttSegments: result?.noSpeech ? [] : (result?.segments ?? []),
      },
    });

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
        onStart={speechConsentGranted ? capture.start : () => undefined}
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
