import React from "react";
import { Exercise } from "../../data/mockExercises";
import { ExerciseState } from "./exerciseTypes/types";
import { MultipleChoiceMeaning } from "./exerciseTypes/MultipleChoiceMeaning";
import { SituationMatch } from "./exerciseTypes/SituationMatch";
import { PairMatching } from "./exerciseTypes/PairMatching";
import { PersonalMemoryRecall } from "./exerciseTypes/PersonalMemoryRecall";

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
          options={exercise.payload.options}
          correctOptionId={exercise.correctAnswer}
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
          options={exercise.payload.options}
          correctOptionId={exercise.correctAnswer}
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
          pairs={exercise.payload.pairs}
          explanation={exercise.explanation}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
        />
      );

    case "personal_memory_recall":
      return (
        <PersonalMemoryRecall
          prompt={exercise.prompt}
          options={exercise.payload.options}
          memoryId={exercise.payload.memoryId}
          linkedConceptId={exercise.payload.linkedConceptId}
          correctOptionId={exercise.correctAnswer}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={onComplete}
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
