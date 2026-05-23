import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import {
  clearCognitiveRoutineResults,
  getCognitiveRoutineResults,
} from "../../cognitive/cognitiveRoutineStorage";
import { StroopTouchPractice } from "./StroopTouchPractice";

describe("StroopTouchPractice", () => {
  beforeEach(async () => {
    localStorage.clear();
    clearCognitiveRoutineResults();
    await i18n.changeLanguage("en");
  });

  it("records color-focused taps and response metadata", () => {
    const setGlobalState = vi.fn();

    render(
      <StroopTouchPractice
        prompt="Choose the color you see"
        trials={[
          { id: "trial_1", word: "blue", inkColor: "red" },
          { id: "trial_2", word: "green", inkColor: "blue" },
        ]}
        colorOptions={["red", "blue", "green", "yellow"]}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));

    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");
    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("stroop_touch_practice");
    expect(results[0].completed).toBe(true);
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        trialCount: 2,
        correctCount: 2,
        errorCount: 0,
      }),
    );
    expect(results[0].metadata?.trialResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trialId: "trial_1",
          expectedColor: "red",
          selectedColor: "red",
          correct: true,
        }),
      ]),
    );
  });

  it("continues after an incorrect color tap and stores it without diagnostic labels", () => {
    const setGlobalState = vi.fn();

    render(
      <StroopTouchPractice
        prompt="Choose the color you see"
        trials={[
          { id: "trial_1", word: "blue", inkColor: "red" },
          { id: "trial_2", word: "green", inkColor: "blue" },
        ]}
        colorOptions={["red", "blue", "green", "yellow"]}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Green" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));

    const results = getCognitiveRoutineResults();
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        correctCount: 1,
        errorCount: 1,
      }),
    );
    expect(JSON.stringify(results[0].metadata)).not.toMatch(/diagnosis|risk|dementia/i);
  });
});
