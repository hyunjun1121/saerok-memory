import type { Exercise } from "../../data/mockExercises";
import type { ExerciseState } from "./exerciseTypes/types";
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

  switch (exercise.type) {
    case "multiple_choice_meaning":
      return (
        <MultipleChoiceMeaning
          prompt={exercise.prompt}
          options={exercise.payload.options ?? []}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          explanation={exercise.explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "situation_match":
      return (
        <SituationMatch
          prompt={exercise.prompt}
          options={exercise.payload.options ?? []}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          explanation={exercise.explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "pair_matching":
      return (
        <PairMatching
          prompt={exercise.prompt}
          pairs={exercise.payload.pairs ?? []}
          explanation={exercise.explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "sequence_order":
      return (
        <SequenceOrder
          prompt={exercise.prompt}
          items={exercise.payload.items ?? []}
          correctOrder={Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer : []}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      );

    case "audio_choice":
      return (
        <AudioChoice
          prompt={exercise.prompt}
          options={exercise.payload.options ?? []}
          audioText={exercise.payload.audioText}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      );

    case "picture_choice":
      return (
        <PictureChoice
          prompt={exercise.prompt}
          options={exercise.payload.options ?? []}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          globalState={globalState}
          setGlobalState={setGlobalState}
        />
      );

    case "personal_memory_recall":
      return (
        <PersonalMemoryRecall
          prompt={exercise.prompt}
          options={exercise.payload.options ?? []}
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
          prompt={exercise.prompt}
          phase={exercise.payload.phase || "encode"}
          wordSetId={exercise.payload.wordSetId}
          words={exercise.payload.words}
          options={exercise.payload.options}
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
          prompt={exercise.prompt}
          pattern={exercise.payload.pattern ?? []}
          options={exercise.payload.options ?? []}
          correctOptionId={typeof exercise.correctAnswer === "string" ? exercise.correctAnswer : ""}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "shape_copy_practice":
      return (
        <ShapeCopyPractice
          prompt={exercise.prompt}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState={globalState}
        />
      );

    case "speech_repeat_practice":
      return (
        <SpeechRepeatPractice
          prompt={exercise.prompt}
          phrase={exercise.payload.phrase ?? ""}
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
