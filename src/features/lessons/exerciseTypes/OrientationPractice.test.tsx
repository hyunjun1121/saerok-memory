import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCognitiveRoutineResults, getCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import i18n from "@/i18n";
import { OrientationPractice } from "@/features/lessons/exerciseTypes/OrientationPractice";

describe("OrientationPractice", () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    clearCognitiveRoutineResults();
    i18n.changeLanguage("ko");
  });

  it("stores a matched date-weekday routine the moment the choice is tapped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T09:00:00.000Z"));

    const setGlobalState = vi.fn();

    render(
      <OrientationPractice
        prompt="오늘 날짜를 골라보세요"
        targetDateISO="2026-05-23"
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    const expectedLabel = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date("2026-05-23T12:00:00"));

    fireEvent.click(screen.getByRole("button", { name: expectedLabel }));

    // Immediate result — no separate confirm step.
    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("orientation_practice");
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        kind: "date_weekday",
        targetDateISO: "2026-05-23",
        matchedExpected: true,
      }),
    );
    expect(results[0].metadata?.selectedOption).toEqual(
      expect.objectContaining({
        label: expectedLabel,
        offsetDays: 0,
      }),
    );
  });

  it("stores an unmatched answer immediately without diagnostic labels", () => {
    const setGlobalState = vi.fn();

    render(
      <OrientationPractice
        prompt="오늘 날짜를 골라보세요"
        targetDateISO="2026-05-23"
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    const wrongOption = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("2026년 5월 22일"));
    expect(wrongOption).toBeTruthy();

    fireEvent.click(wrongOption as HTMLElement);

    expect(setGlobalState).toHaveBeenCalledWith("incorrect_feedback");

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        matchedExpected: false,
      }),
    );
  });
});
