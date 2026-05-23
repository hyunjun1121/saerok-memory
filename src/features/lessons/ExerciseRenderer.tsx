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
import { DigitSpanPractice } from "./exerciseTypes/DigitSpanPractice";
import { VerbalFluencyPractice } from "./exerciseTypes/VerbalFluencyPractice";
import { TrailSwitchingPractice } from "./exerciseTypes/TrailSwitchingPractice";
import { StroopTouchPractice } from "./exerciseTypes/StroopTouchPractice";
import { OrientationPractice } from "./exerciseTypes/OrientationPractice";
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
  const wordCategoryCues = (exercise.payload.wordCategoryCues ?? []).map((cue) => ({
    word: getLocalizedText(cue.word, language),
    category: getLocalizedText(cue.category, language),
  }));
  const audioText = getLocalizedText(exercise.payload.audioText, language);
  const phrase = getLocalizedText(exercise.payload.phrase, language);
  const fluencyCategory = getLocalizedText(exercise.payload.fluencyCategory, language);
  const trailNodes = (exercise.payload.trailNodes ?? []).map((node) => ({
    ...node,
    label: getLocalizedText(node.label, language),
  }));
  const stroopTrials = (exercise.payload.stroopTrials ?? []).map((trial) => ({
    ...trial,
    word: getLocalizedText(trial.word, language),
  }));

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
          wordCategoryCues={wordCategoryCues}
          options={options}
          requiredSelectionCount={exercise.payload.requiredSelectionCount}
          plannedDelayMinutes={exercise.payload.plannedDelayMinutes}
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

    case "digit_span_practice":
      return (
        <DigitSpanPractice
          prompt={prompt}
          digits={exercise.payload.digits ?? []}
          direction={exercise.payload.direction ?? "backward"}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "verbal_fluency_practice":
      return (
        <VerbalFluencyPractice
          prompt={prompt}
          category={fluencyCategory}
          durationSeconds={exercise.payload.durationSeconds ?? 30}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "trail_switching_practice":
      return (
        <TrailSwitchingPractice
          prompt={prompt}
          nodes={trailNodes}
          expectedTrail={exercise.payload.expectedTrail ?? []}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "stroop_touch_practice":
      return (
        <StroopTouchPractice
          prompt={prompt}
          trials={stroopTrials}
          colorOptions={exercise.payload.stroopColorOptions ?? []}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "orientation_practice":
      return (
        <OrientationPractice
          prompt={prompt}
          kind={exercise.payload.orientationKind}
          targetDateISO={exercise.payload.targetDateISO}
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
