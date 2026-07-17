import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChoiceCard } from "@/components/ChoiceCard";
import "@/i18n";

describe("ChoiceCard accessibility", () => {
  it("conveys selection without color: aria-pressed + visible status label", () => {
    render(
      <ChoiceCard
        id="a"
        label="사과"
        state="selected"
        onSelect={vi.fn()}
        keyboardShortcut="1"
      />,
    );

    const button = screen.getByRole("button", { name: "사과" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("aria-keyshortcuts", "1");
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

  it.each([
    ["red", "border-red-500", "bg-red-50", "text-red-950"],
    ["yellow", "border-yellow-700", "bg-yellow-50", "text-yellow-950"],
    ["green", "border-green-600", "bg-green-50", "text-green-950"],
    ["blue", "border-blue-600", "bg-blue-50", "text-blue-950"],
  ] as const)("renders the optional %s tone without changing state semantics", (tone, ...classes) => {
    render(
      <ChoiceCard
        id="a"
        label="사과"
        state="idle"
        onSelect={vi.fn()}
        tone={tone}
      />,
    );

    const button = screen.getByRole("button", { name: "사과" });
    expect(button).toHaveAttribute("data-choice-tone", tone);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveClass(...classes);
  });

  it("strengthens a colored selection with matching fill, ring, and non-color cues", () => {
    const { container } = render(
      <ChoiceCard
        id="a"
        label="사과"
        state="selected"
        onSelect={vi.fn()}
        tone="blue"
      />,
    );

    const button = screen.getByRole("button", { name: "사과" });
    expect(button).toHaveClass(
      "border-blue-800",
      "bg-blue-200",
      "text-blue-950",
      "ring-blue-300",
      "scale-[1.02]",
    );
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("선택됨")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("supports a square tile layout without changing the default row layout", () => {
    const { rerender } = render(
      <ChoiceCard id="a" label="사과" state="idle" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "사과" })).not.toHaveClass(
      "aspect-square",
    );

    rerender(
      <ChoiceCard
        id="a"
        label="사과"
        state="idle"
        onSelect={vi.fn()}
        layout="tile"
      />,
    );

    expect(screen.getByRole("button", { name: "사과" })).toHaveClass(
      "aspect-square",
      "text-center",
    );
  });
});
