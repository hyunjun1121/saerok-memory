import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCognitiveRoutineResults, getCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import i18n from "@/i18n";
import { DelayedWordRecall } from "@/features/lessons/exerciseTypes/DelayedWordRecall";

describe("DelayedWordRecall", () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    clearCognitiveRoutineResults();
  });

  it("encode phase stores words with category cues and planned delay metadata", () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
      <DelayedWordRecall
        prompt="Remember these"
        phase="encode"
        wordSetId="set-a"
        words={["pencil", "apple", "bus"]}
        wordCategoryCues={[
          { word: "pencil", category: "writing tool" },
          { word: "apple", category: "fruit" },
          { word: "bus", category: "vehicle" },
        ]}
        plannedDelayMinutes={3}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    expect(screen.getByText("writing tool")).toBeInTheDocument();
    expect(screen.getByText("pencil")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.cognitive.ready") }));

    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");
    expect(onComplete).toHaveBeenCalled();

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("delayed_word_recall");
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        phase: "encode",
        wordSetId: "set-a",
        wordCount: 3,
        plannedDelayMinutes: 3,
      }),
    );
    expect(results[0].metadata?.wordCategoryCues).toEqual([
      { word: "pencil", category: "writing tool" },
      { word: "apple", category: "fruit" },
      { word: "bus", category: "vehicle" },
    ]);
  });

  it("recall phase stores selected answers, correct count, and observed delay", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T09:00:00.000Z"));

    localStorage.setItem(
      "cognitiveRoutineResults",
      JSON.stringify([
        {
          id: "encode_1",
          type: "delayed_word_recall",
          timestamp: "2026-05-23T08:56:00.000Z",
          completed: true,
          metadata: {
            phase: "encode",
            wordSetId: "set-a",
          },
        },
      ]),
    );

    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    const { rerender } = render(
      <DelayedWordRecall
        prompt="Recall these"
        phase="recall"
        wordSetId="set-a"
        options={[
          { id: "w1", label: "pencil" },
          { id: "w2", label: "car" },
          { id: "w3", label: "apple" },
          { id: "w4", label: "bus" },
        ]}
        wordCategoryCues={[
          { word: "pencil", category: "writing tool" },
          { word: "apple", category: "fruit" },
          { word: "bus", category: "vehicle" },
        ]}
        requiredSelectionCount={3}
        plannedDelayMinutes={3}
        expectedAnswers={["w1", "w3", "w4"]}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.change(
      screen.getByLabelText(new RegExp(i18n.t("exercise.cognitive.wordRecallFreeLabel"))),
      {
        target: { value: "pencil, apple, train" },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "pencil" }));
    expect(setGlobalState).toHaveBeenCalledWith("awaiting_answer");

    fireEvent.click(screen.getByRole("button", { name: "car" }));
    expect(setGlobalState).toHaveBeenCalledWith("awaiting_answer");

    fireEvent.click(screen.getByRole("button", { name: "apple" }));
    expect(setGlobalState).toHaveBeenCalledWith("answer_selected");

    rerender(
      <DelayedWordRecall
        prompt="Recall these"
        phase="recall"
        wordSetId="set-a"
        options={[
          { id: "w1", label: "pencil" },
          { id: "w2", label: "car" },
          { id: "w3", label: "apple" },
          { id: "w4", label: "bus" },
        ]}
        wordCategoryCues={[
          { word: "pencil", category: "writing tool" },
          { word: "apple", category: "fruit" },
          { word: "bus", category: "vehicle" },
        ]}
        requiredSelectionCount={3}
        plannedDelayMinutes={3}
        expectedAnswers={["w1", "w3", "w4"]}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="answer_selected"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(2);
    expect(results[1].type).toBe("delayed_word_recall");
    expect(results[1].metadata).toEqual(
      expect.objectContaining({
        phase: "recall",
        wordSetId: "set-a",
        correctCount: 2,
        requiredSelectionCount: 3,
        plannedDelayMinutes: 3,
        observedDelayMs: 240000,
        observedDelayMinutes: 4,
        recallMode: "free_recall_then_recognition_choice",
        freeRecallEntries: ["pencil", "apple", "train"],
        freeRecallCorrectCount: 2,
        freeRecallExtraCount: 1,
      }),
    );
    expect(results[1].metadata?.selectedAnswers).toEqual(["w1", "w2", "w3"]);
    expect(results[1].metadata?.expectedAnswers).toEqual(["w1", "w3", "w4"]);
    expect(results[1].metadata?.wordCategoryCues).toEqual([
      { word: "pencil", category: "writing tool" },
      { word: "apple", category: "fruit" },
      { word: "bus", category: "vehicle" },
    ]);
  });
});
