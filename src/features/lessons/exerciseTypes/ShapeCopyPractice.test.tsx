import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCognitiveRoutineResults, getCognitiveRoutineResults } from "../../cognitive/cognitiveRoutineStorage";
import i18n from "../../../i18n";
import { ShapeCopyPractice } from "./ShapeCopyPractice";

describe("ShapeCopyPractice", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    }) as unknown as HTMLCanvasElement["getContext"];

    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/png;base64,mock");
  });

  it("records drawing metadata for later non-diagnostic review", () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
      <ShapeCopyPractice
        prompt="Draw"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    expect(setGlobalState).toHaveBeenCalledWith("answer_selected");

    const canvas = screen.getByLabelText(i18n.t("exercise.cognitive.drawingArea"));
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 40 });
    fireEvent.mouseUp(canvas);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.cognitive.done") }));

    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");
    expect(onComplete).toHaveBeenCalled();

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("shape_copy_practice");
    expect(results[0].metadata?.hasDrawn).toBe(true);
    expect(results[0].metadata?.template).toBe("simple_house_copy");
    expect(results[0].metadata?.strokeCount).toBe(1);
    expect(results[0].metadata?.sampledPointCount).toBeGreaterThanOrEqual(2);
    expect(results[0].metadata?.pathLengthPx).toBeGreaterThan(0);
    expect(results[0].metadata?.clearCount).toBe(0);
    expect(Array.isArray(results[0].metadata?.sampledPath)).toBe(true);
  });
});
