import type { Exercise } from "../../data/mockExercises";
import type { ExerciseState } from "./exerciseTypes/types";
import { getLocalizedText } from "../../utils/localizedText";
import { MultipleChoiceMeaning } from "./exerciseTypes/MultipleChoiceMeaning";
import { SituationMatch } from "./exerciseTypes/SituationMatch";
import { PairMatching } from "./exerciseTypes/PairMatching";
import { PersonalMemoryRecall } from "./exerciseTypes/PersonalMemoryRecall";
import { SequenceOrder } from "./exerciseTypes/SequenceOrder";
import { AudioChoice } from "./exerciseTypes/AudioChoice";
import { PictureChoice } from "./exerciseTypes/PictureChoice";
import { DelayedWordRecall } from "./exerciseTypes/DelayedWordRecall";
import { AttentionPattern } from "./exerciseTypes/AttentionPattern";
import { ShapeCopyPractice } from "./exerciseTypes/ShapeCopyPractice";
import { SpeechRepeatPractice } from "./exerciseTypes/SpeechRepeatPractice";
import { useTranslation } from "react-i18next";

interface ExerciseRendererProps {
  exercise: Exercise;
  globalState: ExerciseState;
  setGlobalState: (state: ExerciseState) => void;
  onComplete: () => void;
}

export function ExerciseRenderer({
  exercise,
  globalState,
  setGlobalState,
  onComplete,
}: ExerciseRendererProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;
  const prompt = getLocalizedText(exercise.prompt, language);
  const explanation = getLocalizedText(exercise.explanation, language);
  const options = (exercise.payload.options ?? []).map((option) => ({
    ...option,
    label: getLocalizedText(option.label, language),
    accessibilityLabel: getLocalizedText(option.accessibilityLabel, language),
  }));
  const items = (exercise.payload.items ?? []).map((item) => ({
    ...item,
    label: getLocalizedText(item.label, language),
    accessibilityLabel: getLocalizedText(item.accessibilityLabel, language),
  }));
  const pairs = (exercise.payload.pairs ?? []).map((pair) => ({
    ...pair,
    left: getLocalizedText(pair.left, language),
    right: getLocalizedText(pair.right, language),
  }));
  const words = exercise.payload.words?.map((word) => getLocalizedText(word, language));
  const audioText = getLocalizedText(exercise.payload.audioText, language);
  const phrase = getLocalizedText(exercise.payload.phrase, language);

  switch (exercise.type) {
    case "multiple_choice_meaning":
      return (
        <MultipleChoiceMeaning
          prompt={prompt}
          options={options}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          explanation={explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "situation_match":
      return (
        <SituationMatch
          prompt={prompt}
          options={options}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          explanation={explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "pair_matching":
      return (
        <PairMatching
          prompt={prompt}
          pairs={pairs}
          explanation={explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "sequence_order":
      return (
        <SequenceOrder
          prompt={prompt}
          items={items}
          correctOrder={Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer : []}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      );

    case "audio_choice":
      return (
        <AudioChoice
          prompt={prompt}
          options={options}
          audioText={audioText}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      );

    case "picture_choice":
      return (
        <PictureChoice
          prompt={prompt}
          options={options}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      );

    case "personal_memory_recall":
      return (
        <PersonalMemoryRecall
          prompt={prompt}
          options={options}
          memoryId={exercise.payload.memoryId}
          linkedConceptId={exercise.payload.linkedConceptId}
          memoryField={exercise.payload.memoryField}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : undefined}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "delayed_word_recall":
      return (
        <DelayedWordRecall
          prompt={prompt}
          phase={exercise.payload.phase || "encode"}
          wordSetId={exercise.payload.wordSetId}
          words={words}
          options={options}
          requiredSelectionCount={exercise.payload.requiredSelectionCount}
          expectedAnswers={Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer : []}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "attention_pattern":
      return (
        <AttentionPattern
          prompt={prompt}
          pattern={exercise.payload.pattern ?? []}
          options={options}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "shape_copy_practice":
      return (
        <ShapeCopyPractice
          prompt={prompt}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "speech_repeat_practice":
      return (
        <SpeechRepeatPractice
          prompt={prompt}
          phrase={phrase}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    default:
      return (
        <div className="p-4 bg-red-50 text-red-500 rounded-xl">
          Unsupported exercise type: {exercise.type}
        </div>
      );
  }
}
