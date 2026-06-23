import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChoiceCard } from "./ChoiceCard";
import "../i18n";

describe("ChoiceCard accessibility", () => {
  it("conveys selection without color: aria-pressed + visible status label", () => {
    render(
      <ChoiceCard id="a" label="사과" state="selected" onSelect={vi.fn()} />,
    );

    const button = screen.getByRole("button", { name: "사과" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    // Non-color status cue visible to sighted users.
    expect(screen.getByText("선택됨")).toBeInTheDocument();
  });

  it("marks correct state as pressed and shows a completion label", () => {
    render(
      <ChoiceCard id="a" label="사과" state="correct" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "사과" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("idle state is not pressed and shows no status label", () => {
    render(
      <ChoiceCard id="a" label="사과" state="idle" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "사과" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText("선택됨")).not.toBeInTheDocument();
  });

  it("SP-03: selected uses amber fill + ring and shows a check icon", () => {
    const { container } = render(
      <ChoiceCard id="a" label="사과" state="selected" onSelect={vi.fn()} />,
    );
    const btn = screen.getByRole("button", { name: "사과" });
    expect(btn.className).toContain("bg-amber-50");
    expect(btn.className).toContain("ring-amber-200");
    expect(btn.className).not.toContain("bg-blue-50");
    // A check (svg) icon is rendered for the selected state.
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
