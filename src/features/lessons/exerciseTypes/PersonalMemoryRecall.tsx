import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Mic, Square } from "lucide-react";
import { ChoiceCard } from "../../../components/ChoiceCard";
import { Button3D } from "../../../components/Button3D";
import type { ExerciseState } from "./types";
import type { MemoryCard, MemoryTopic } from "../../memory/types";
import { calculateNextReviewState } from "../../memory/memoryScheduler";
import { upsertMemoryCueCard, getMemoryCards, saveMemoryCards } from "../../memory/memoryCardStorage";
import { extractMemoryStoryCues, normalizeMemoryStory, summarizeMemoryStory } from "../../memory/memoryStory";
import { getSpeechLanguage } from "../../../utils/localizedText";

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

type SpeechRecognitionEventLike = Event & {
  results: {
    length: number;
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionLike = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onerror: () => void;
  onend: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

interface PersonalMemoryRecallProps {
  prompt: string;
  options: Option[];
  memoryId?: string;
  linkedConceptId?: string;
  memoryField?: MemoryField;
  correctOptionId?: string;
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
  setGlobalState,
  globalState,
}: PersonalMemoryRecallProps) {
  const { t, i18n } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [hiddenOptionIds, setHiddenOptionIds] = useState<Set<string>>(new Set());
  const [storyText, setStoryText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isReviewMode = !!memoryId && !!correctOptionId;
  const isStoryCreationMode = !isReviewMode && memoryField === "story";
  const speechApiAvailable =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

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

  const handleStoryTextChange = (value: string) => {
    setStoryText(value);
    setGlobalState(normalizeMemoryStory(value) ? "answer_selected" : "awaiting_answer");
  };

  const startListening = () => {
    if (!speechApiAvailable) return;

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionConstructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) return;

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = getSpeechLanguage(i18n.language);
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const fragments: string[] = [];
        for (let i = 0; i < event.results.length; i += 1) {
          const transcript = event.results[i]?.[0]?.transcript;
          if (transcript) fragments.push(transcript);
        }

        const nextText = normalizeMemoryStory(fragments.join(" "));
        if (nextText) {
          setStoryText((prev) => normalizeMemoryStory(`${prev} ${nextText}`));
          setGlobalState("answer_selected");
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const handleSaveStory = () => {
    const normalizedStory = normalizeMemoryStory(storyText);
    if (!normalizedStory) return;

    upsertMemoryCueCard({
      linkedConceptId: linkedConceptId || "daily_memory",
      originalTranscript: normalizedStory,
      textSummary: summarizeMemoryStory(normalizedStory),
      storyCues: extractMemoryStoryCues(normalizedStory),
      sensitivity: "sensitive",
    });

    setGlobalState("correct_feedback");
  };

  const visibleOptions = options.filter(opt => !hiddenOptionIds.has(opt.id));

  if (isStoryCreationMode) {
    const canSaveStory = !!normalizeMemoryStory(storyText);

    return (
      <div className="flex flex-col w-full gap-7">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-pink-500 uppercase tracking-wide">
            {t("exercise.memory.story.label")}
          </span>
          <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
          <p className="text-base font-semibold leading-relaxed text-gray-500">
            {t("exercise.memory.story.helper")}
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border-2 border-pink-100 bg-pink-50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-3 text-pink-500 shadow-sm">
              <Mic className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-extrabold text-ink">
                {t("exercise.memory.story.speakTitle")}
              </h3>
              <p className="text-sm font-semibold text-gray-600">
                {speechApiAvailable
                  ? t("exercise.memory.story.speakBody")
                  : t("exercise.memory.story.unsupported")}
              </p>
            </div>
          </div>

          <Button3D
            variant={!speechApiAvailable ? "disabled" : isListening ? "danger" : "primary"}
            fullWidth
            disabled={!speechApiAvailable}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? (
              <>
                <Square className="mr-2 h-5 w-5" />
                {t("exercise.memory.story.stop")}
              </>
            ) : (
              <>
                <Mic className="mr-2 h-5 w-5" />
                {t("exercise.memory.story.start")}
              </>
            )}
          </Button3D>
        </section>

        <section className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-base font-extrabold text-ink" htmlFor="memory-story-text">
            <Keyboard className="h-5 w-5 text-gray-500" />
            {t("exercise.memory.story.transcriptLabel")}
          </label>
          <textarea
            id="memory-story-text"
            aria-label={t("exercise.memory.story.inputLabel")}
            value={storyText}
            onChange={(event) => handleStoryTextChange(event.target.value)}
            placeholder={t("exercise.memory.story.placeholder")}
            className="min-h-[132px] w-full resize-none rounded-2xl border-2 border-gray-200 bg-white p-4 text-lg font-semibold leading-relaxed text-ink outline-none transition focus:border-primary-500"
          />
          <p className="text-sm font-semibold leading-relaxed text-blue-700">
            {t("exercise.memory.story.privacy")}
          </p>
        </section>

        <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
          <Button3D
            variant={canSaveStory ? "primary" : "disabled"}
            fullWidth
            onClick={handleSaveStory}
          >
            {t("exercise.memory.story.save")}
          </Button3D>
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
