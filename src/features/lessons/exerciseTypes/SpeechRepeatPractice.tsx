import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { Button3D } from "../../../components/Button3D";
import { SpeechCapturePanel } from "../../speech/SpeechCapturePanel";
import { useSpeechCapture } from "../../speech/useSpeechCapture";
import type { ExerciseState } from "./types";
import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";
import { getSpeechLanguage } from "../../../utils/localizedText";
import { useInteractionFeedback } from "../../../hooks/useInteractionFeedback";

// SP-05: token-overlap similarity between the target phrase and the recognized
// transcript. Stored as metadata only — never shown as a score/diagnosis (HL-1).
function computePronunciationSimilarity(target: string, transcript: string): number {
  const tokenize = (s: string) =>
    s
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean);
  const a = new Set(tokenize(target));
  const b = new Set(tokenize(transcript));
  if (a.size === 0) return 0;
  let overlap = 0;
  a.forEach((tok) => {
    if (b.has(tok)) overlap += 1;
  });
  return overlap / a.size;
}

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
  const capture = useSpeechCapture(i18n.language);

  // Let the learner proceed at any time (speech is optional). We intentionally
  // do NOT auto-advance on save — the learner reviews feedback first, then
  // taps Continue (see SP-03).
  useEffect(() => {
    if (globalState === "awaiting_answer" || globalState === "answer_selected") {
      setGlobalState("answer_selected");
    }
  }, [globalState, setGlobalState]);

  const handlePlay = () => {
    // Use the shared calm-TTS primitive so speech respects the learner's sound
    // setting and is a safe no-op where speechSynthesis is missing.
    speak(phrase, getSpeechLanguage(i18n.language));
    setIsPlaying(true);
    // speakCalmly cancels prior utterances and does not expose onend, so clear
    // the playing state shortly after as an approximation of the end.
    window.setTimeout(() => setIsPlaying(false), 1500);
  };

  const handleFinish = () => {
    capture.stop();
    saveCognitiveRoutineResult({
      type: "speech_repeat_practice",
      completed: true,
      metadata: {
        phrase,
        transcript: capture.transcript,
        speechSupported: capture.isSupported,
        listeningDurationMs: capture.durationMs,
        recognitionError: capture.error,
        audioAssetUrl: capture.audioAssetUrl,
        locale: i18n.language,
        inputMode: capture.transcript ? "speech" : "skipped",
        pronunciationSimilarity: capture.transcript
          ? computePronunciationSimilarity(phrase, capture.transcript)
          : null,
      },
    });

    // Feedback first; advancement happens when the learner taps Continue.
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
        isSupported={capture.isSupported}
        isListening={capture.isListening}
        onStart={capture.start}
        onStop={capture.stop}
        startLabel={t("speech.start")}
        stopLabel={t("speech.stop")}
        listeningTitle={t("speech.listeningTitle")}
        listeningBody={t("speech.listeningBody")}
        unsupportedNote={t("speech.unsupported")}
        durationHint={t("speech.durationHint")}
      />

      {capture.transcript && (
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4">
          <p className="text-sm font-bold text-gray-500">{t("speech.recognized")}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{capture.transcript}</p>
        </div>
      )}

      <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
        <Button3D variant="primary" fullWidth onClick={handleFinish}>
          {t("exercise.cognitive.doneSpeaking")}
        </Button3D>
      </div>
    </div>
  );
}
