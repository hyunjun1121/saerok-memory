import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { SequenceOrder } from "@/features/lessons/exerciseTypes/SequenceOrder";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

function Harness() {
  const [state, setState] = useState<ExerciseState>("awaiting_answer");

  return (
    <>
      <output data-testid="state">{state}</output>
      <SequenceOrder
        prompt="처음 들은 순서대로 골라보세요."
        items={[
          { id: "a", label: "사과" },
          { id: "b", label: "우산" },
          { id: "c", label: "버스" },
          { id: "d", label: "모자" },
        ]}
        correctOrder={["a", "b", "c"]}
        requiredSelectionCount={3}
        globalState={state}
        setGlobalState={setState}
      />
    </>
  );
}

describe("SequenceOrder", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ko");
    Object.defineProperty(window, "speechSynthesis", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("submits a three-item remembered sequence from four choices", () => {
    render(<Harness />);

    expect(
      screen.getByRole("button", { name: i18n.t("exercise.sequenceOrder.listen") }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("exercise.sequenceOrder.listen") }),
    );
    expect(screen.getByText(/사과 → 우산 → 버스/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /사과/ }));
    fireEvent.click(screen.getByRole("button", { name: /우산/ }));
    fireEvent.click(screen.getByRole("button", { name: /버스/ }));

    expect(screen.getByTestId("state")).toHaveTextContent("answer_selected");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));
    expect(screen.getByTestId("state")).toHaveTextContent("correct_feedback");
  });
});
