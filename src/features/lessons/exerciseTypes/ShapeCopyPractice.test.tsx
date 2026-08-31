import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCognitiveRoutineResults, getCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import i18n from "@/i18n";
import { ShapeCopyPractice } from "@/features/lessons/exerciseTypes/ShapeCopyPractice";

const analyticsMocks = vi.hoisted(() => ({
  captureHaruTelemetry: vi.fn(async () => true),
}));

vi.mock("@/features/analytics/client", () => analyticsMocks);

describe("ShapeCopyPractice", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();
    analyticsMocks.captureHaruTelemetry.mockClear();

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
    expect(results[0].metadata).not.toHaveProperty("sampledPath");
    expect(results[0].metadata).not.toHaveProperty("dataUrl");
    expect(localStorage.getItem("cognitiveRoutineResults")).not.toContain("data:image/png");
    const telemetryCalls = analyticsMocks.captureHaruTelemetry.mock
      .calls as unknown as Array<[string]>;
    expect(telemetryCalls.map(([eventName]) => eventName)).toEqual([
      "drawing_progress",
      "drawing_progress",
    ]);
    expect(analyticsMocks.captureHaruTelemetry).toHaveBeenLastCalledWith(
      "drawing_progress",
      expect.objectContaining({
        phase: "completed",
        strokeCount: 1,
        pointCount: expect.any(Number),
        eraseCount: 0,
      }),
    );
  });
});
