import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import {
  clearCognitiveRoutineResults,
  getCognitiveRoutineResults,
} from "@/features/cognitive/cognitiveRoutineStorage";
import { TrailSwitchingPractice, type RenderedTrailNode } from "@/features/lessons/exerciseTypes/TrailSwitchingPractice";

const nodes: RenderedTrailNode[] = [
  { id: "n1", label: "1", group: "number", x: 20, y: 20 },
  { id: "s1", label: "꽃", group: "symbol", x: 70, y: 25 },
  { id: "n2", label: "2", group: "number", x: 45, y: 60 },
];

describe("TrailSwitchingPractice", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();
  });

  it("stores click sequence, errors, and elapsed time as routine metadata", () => {
    const setGlobalState = vi.fn();

    render(
      <TrailSwitchingPractice
        prompt="길을 완성해 보세요"
        nodes={nodes}
        expectedTrail={["n1", "s1", "n2"]}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "꽃 누르기" }));
    fireEvent.click(screen.getByRole("button", { name: "1 누르기" }));
    fireEvent.click(screen.getByRole("button", { name: "꽃 누르기" }));
    fireEvent.click(screen.getByRole("button", { name: "2 누르기" }));

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("trail_switching_practice");
    expect(results[0].completed).toBe(true);
    expect(results[0].metadata).toEqual(
      expect.objectContaining({
        expectedTrail: ["n1", "s1", "n2"],
        clickedNodeIds: ["n1", "s1", "n2"],
        errorCount: 1,
        nodeCount: 3,
      }),
    );
    expect(typeof results[0].metadata?.elapsedMs).toBe("number");
    expect(setGlobalState).toHaveBeenCalledWith("correct_feedback");
  });

  it("can reset the trail after an incorrect tap", () => {
    const setGlobalState = vi.fn();

    render(
      <TrailSwitchingPractice
        prompt="길을 완성해 보세요"
        nodes={nodes}
        expectedTrail={["n1", "s1", "n2"]}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "꽃 누르기" }));
    expect(screen.getByText("표시된 다음 단서를 눌러보세요.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시" }));

    expect(screen.queryByText("표시된 다음 단서를 눌러보세요.")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
