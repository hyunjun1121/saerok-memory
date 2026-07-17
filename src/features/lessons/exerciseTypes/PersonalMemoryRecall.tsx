import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChoiceCard } from "@/components/ChoiceCard";
import { Button3D } from "@/components/Button3D";
import { HARU_DEMO_PERSONA } from "@/data/haru7DayExercises";
import { VoiceWaveform } from "@/features/speech/VoiceWaveform";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import type { MemoryCard, MemoryTopic } from "@/features/memory/types";
import { calculateNextReviewState } from "@/features/memory/memoryScheduler";
import { upsertMemoryCueCard, getMemoryCards, saveMemoryCards } from "@/features/memory/memoryCardStorage";
import { summarizeMemoryStory, extractMemoryStoryCues } from "@/features/memory/memoryStory";
import { formatSttEngine, transcribeStory } from "@/features/speech/stt";

function updateMemoryCard(cardId: string, result: "remembered" | "hint_used" | "missed") {
  const existing = getMemoryCards();
  const idx = existing.findIndex(c => c.id === cardId);
  if (idx >= 0) {
    const card = existing[idx];
    card.reviewState = calculateNextReviewState(card.reviewState, result);
    card.updatedAt = new Date().toISOString();
    saveMemoryCards(existing);
  }
}

interface Option {
  id: string;
  label: string;
  value?: string;
}

type MemoryField = "topic" | "emotionTag" | "peopleTags" | "placeTag" | "story";

interface PersonalMemoryRecallProps {
  prompt: string;
  options: Option[];
  memoryId?: string;
  linkedConceptId?: string;
  memoryField?: MemoryField;
  correctOptionId?: string;
  maxDurationSeconds?: number;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function PersonalMemoryRecall({
  prompt,
  options,
  memoryId,
  linkedConceptId,
  memoryField = "topic",
  correctOptionId,
  maxDurationSeconds = 60,
  onComplete,
  setGlobalState,
  globalState,
}: PersonalMemoryRecallProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [hiddenOptionIds, setHiddenOptionIds] = useState<Set<string>>(new Set());
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorder = useVoiceRecorder(maxDurationSeconds * 1000);

  const isReviewMode = !!memoryId && !!correctOptionId;
  const isStoryCreationMode = !isReviewMode && memoryField === "story";
  const voiceRecordingConsented = HARU_DEMO_PERSONA.consents.voiceRecording;
  const sttProcessingConsented = HARU_DEMO_PERSONA.consents.sttProcessing;
  const speechConsentGranted = voiceRecordingConsented && sttProcessingConsented;

  // onComplete is owned by the parent; this component relies on global feedback
  // state for advancement.
  void onComplete;

  // Voice-only story routine: start capturing the moment the screen appears so
  // the learner just talks — no button to find, no typing. Safe no-op where the
  // mic is unavailable.
  useEffect(() => {
    if (isStoryCreationMode && speechConsentGranted && recorder.isSupported) {
      recorder.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoryCreationMode, speechConsentGranted]);

  const handleSelect = (id: string) => {
    if (
      globalState === "correct_feedback" ||
      globalState === "incorrect_feedback" ||
      globalState === "hint_feedback"
    ) {
      return;
    }
    setSelectedId(id);
    setGlobalState("answer_selected");
  };

  const handleCheck = () => {
    if (!selectedId) return;

    if (isReviewMode) {
      if (selectedId === correctOptionId) {
        setGlobalState("correct_feedback");
        updateMemoryCard(memoryId!, missCount === 0 ? "remembered" : "hint_used");
      } else {
        const newMissCount = missCount + 1;
        setMissCount(newMissCount);

        if (newMissCount === 1) {
          setHiddenOptionIds((prev) => new Set(prev).add(selectedId));
          setGlobalState("hint_feedback");
          setSelectedId(null);
        } else {
          setGlobalState("incorrect_feedback");
          updateMemoryCard(memoryId!, "missed");
        }
      }
    } else {
      const selectedOption = options.find((o) => o.id === selectedId);
      const selectedValue = selectedOption?.value ?? selectedOption?.label ?? "unknown";

      const cardUpdate: Partial<MemoryCard> & { linkedConceptId: string } = {
        linkedConceptId: linkedConceptId || "unknown",
      };

      if (memoryField === "emotionTag") {
        cardUpdate.emotionTag = selectedValue;
      } else if (memoryField === "peopleTags") {
        cardUpdate.peopleTags = [selectedValue];
      } else if (memoryField === "placeTag") {
        cardUpdate.placeTag = selectedValue;
      } else {
        cardUpdate.topic = selectedValue as MemoryTopic;
      }

      upsertMemoryCueCard(cardUpdate);
      setGlobalState("correct_feedback");
    }
  };

  // Finish the voice story: stop recording, send the audio to the STT backend
  // (Korean -> text), then store the transcript + summary + extracted cues on
  // the memory card. STT is best-effort — on any failure we still save the card
  // (empty transcript, recognitionError set) so the learner is never blocked.
  const handleFinishStory = async () => {
    setIsTranscribing(true);

    // stopAndGetBlob resolves once MediaRecorder finalizes the blob; if the mic
    // was unsupported (jsdom / denied) it resolves immediately with null.
    const blob = speechConsentGranted ? await recorder.stopAndGetBlob() : null;

    let transcript = "";
    let recognitionError: string | null = !voiceRecordingConsented
      ? "voice-consent-required"
      : !sttProcessingConsented
        ? "stt-consent-required"
        : recorder.error;
    const result = blob && blob.size > 0 ? await transcribeStory(blob) : null;
    if (result) {
      if (result.noSpeech) {
        recognitionError = "no-speech";
      } else if (result.text) {
        transcript = result.text;
        recognitionError = null;
      } else {
        recognitionError = recognitionError ?? "transcribe-failed";
      }
    } else if (speechConsentGranted && blob && blob.size > 0) {
      recognitionError = recognitionError ?? "transcribe-failed";
    }

    upsertMemoryCueCard({
      linkedConceptId: linkedConceptId || "daily_memory",
      originalTranscript: transcript,
      textSummary: transcript ? summarizeMemoryStory(transcript) : "",
      storyCues: transcript ? extractMemoryStoryCues(transcript) : undefined,
      inputMode: transcript ? "speech" : "skipped",
      speechDurationMs: speechConsentGranted ? recorder.getDurationMs() : 0,
      recognitionError,
      audioAssetUrl: speechConsentGranted ? recorder.audioAssetUrl : null,
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
      sensitivity: "sensitive",
    });

    setIsTranscribing(false);
    setGlobalState("correct_feedback");
  };

  const visibleOptions = options.filter(opt => !hiddenOptionIds.has(opt.id));

  if (isStoryCreationMode) {
    return (
      <div className="flex flex-col w-full gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-pink-500 uppercase tracking-wide">
            {t("exercise.memory.story.label")}
          </span>
          <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
          <p className="text-base font-semibold leading-relaxed text-gray-500">
            {t("exercise.memory.story.helper")}
          </p>
        </div>

        <div
          className={`flex flex-col items-center gap-4 rounded-2xl border-[3px] p-6 ring-4 ${
            recorder.isRecording
              ? "border-red-500 bg-red-50 ring-red-200"
              : "border-primary-500 bg-primary-50 ring-primary-200"
          }`}
        >
          <span
            className={`flex items-center gap-3 text-2xl font-extrabold ${
              recorder.isRecording ? "text-red-600" : "text-primary-700"
            }`}
          >
            {recorder.isRecording && (
              <span className="relative flex h-5 w-5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-red-600" />
              </span>
            )}
            {recorder.isRecording
              ? t("speech.listeningTitle")
              : recorder.isFinalizing
                ? t("exercise.memory.story.finalizingLabel")
                : recorder.audioAssetUrl
                  ? t("exercise.memory.story.recordedLabel")
                  : t("exercise.memory.story.readyLabel")}
          </span>
          <VoiceWaveform
            levels={recorder.levels}
            active={recorder.isRecording}
            ariaLabel={t("speech.listeningTitle")}
          />
          <p className="text-base font-semibold text-gray-600">
            {t("speech.durationLimit", { seconds: maxDurationSeconds })}
          </p>
        </div>

        {!speechConsentGranted && (
          <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-relaxed text-amber-800">
            {t("speech.consentRequired")}
          </p>
        )}

        {speechConsentGranted && !recorder.isSupported && (
          <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-relaxed text-amber-800">
            {t("exercise.memory.story.unsupported")}
          </p>
        )}

        <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30" data-story-finish>
          {isTranscribing ? (
            <div
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary-500 bg-primary-50 px-6 py-5 text-xl font-extrabold text-primary-700 shadow-md"
              role="status"
              aria-live="polite"
            >
              <span
                className="h-5 w-5 animate-spin rounded-full border-4 border-primary-300 border-t-primary-700"
                aria-hidden="true"
              />
              {t("speech.transcribing")}
            </div>
          ) : (
            <Button3D variant="primary" fullWidth onClick={handleFinishStory}>
              {t("exercise.memory.story.finish")}
            </Button3D>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-pink-500 uppercase tracking-wide">
          {t("exercise.memory.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex flex-col gap-4">
        {visibleOptions.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (globalState === "answer_selected" && selectedId === option.id) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
            if (isReviewMode && option.id === correctOptionId) state = "correct";
            else if (!isReviewMode && selectedId === option.id) state = "correct";
            else state = "disabled";
          } else if (
            globalState === "incorrect_feedback" &&
            selectedId === option.id
          ) {
            state = "incorrect";
          } else if (
            globalState === "incorrect_feedback" ||
            globalState === "hint_feedback"
          ) {
            state = "disabled";
          }

          return (
            <ChoiceCard
              key={option.id}
              id={option.id}
              label={option.label}
              state={state}
              onSelect={handleSelect}
            />
          );
        })}
      </div>

      {(globalState === "awaiting_answer" || globalState === "answer_selected") && (
        <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
          <Button3D
            variant={globalState === "answer_selected" ? "primary" : "disabled"}
            fullWidth
            onClick={handleCheck}
          >
            {t("exercise.memory.select")}
          </Button3D>
        </div>
      )}
    </div>
  );
}
