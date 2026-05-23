import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../../i18n";
import {
  clearCognitiveRoutineResults,
  getCognitiveRoutineResults,
} from "../../cognitive/cognitiveRoutineStorage";
import { VerbalFluencyPractice } from "./VerbalFluencyPractice";

describe("VerbalFluencyPractice", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();
  });

  it("stores unique and repeated word metadata as a non-diagnostic routine record", () => {
    const setGlobalState = vi.fn();
    const onComplete = vi.fn();

    render(
      <VerbalFluencyPractice
        prompt="동물 이름을 떠올려보세요"
        category="동물"
        durationSeconds={30}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.change(screen.getByLabelText("떠오른 단어"), {
      target: { value: "고양이, 강아지, 고양이" },
    });
    fireEvent.click(screen.getByRole("button", { name: "단어 추가" }));
    fireEvent.click(screen.getByRole("button", { name: "저장하고 다음으로" }));

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("verbal_fluency_practice");
    expect(results[0].completed).toBe(true);
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        category: "동물",
        durationSeconds: 30,
        entries: ["고양이", "강아지", "고양이"],
        uniqueCount: 2,
        repetitionCount: 1,
      }),
    );
    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");
    expect(onComplete).toHaveBeenCalled();
  });

  it("lets users remove an entered word before saving", () => {
    render(
      <VerbalFluencyPractice
        prompt="동물 이름을 떠올려보세요"
        category="동물"
        durationSeconds={30}
        onComplete={vi.fn()}
        setGlobalState={vi.fn()}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.change(screen.getByLabelText("떠오른 단어"), {
      target: { value: "고양이, 강아지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "단어 추가" }));

    fireEvent.click(screen.getByRole("button", { name: "고양이 지우기" }));

    expect(screen.queryByRole("button", { name: "고양이 지우기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "강아지 지우기" })).toBeInTheDocument();
  });
});
