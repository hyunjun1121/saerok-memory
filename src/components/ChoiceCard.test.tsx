import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChoiceCard } from "@/components/ChoiceCard";
import "@/i18n";

const feedbackMocks = vi.hoisted(() => ({
  playInteractionCue: vi.fn(() => Promise.resolve()),
  playSoftTapTone: vi.fn(),
  playSoftSuccessTone: vi.fn(),
  vibrateLightly: vi.fn(),
  speakCalmly: vi.fn(),
}));

vi.mock("@/hooks/interactionFeedback", () => feedbackMocks);

describe("ChoiceCard accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

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

  it("keeps the tile check inside its status badge instead of covering the label", () => {
    render(
      <ChoiceCard
        id="a"
        label="매우 좋음"
        state="selected"
        onSelect={vi.fn()}
        layout="tile"
      />,
    );

    const status = screen.getByText("선택됨");
    expect(status).toHaveClass("inline-flex");
    expect(status.querySelector("svg")).not.toBeNull();
  });

  it("supports a square tile layout without changing the default row layout", () => {
    const { rerender } = render(
      <ChoiceCard id="a" label="사과" state="idle" onSelect={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "사과" })).not.toHaveClass(
      "aspect-square",
    );
    expect(screen.getByText("사과")).toHaveClass("text-xl");
    expect(screen.getByText("사과")).not.toHaveAttribute("data-choice-label-size");

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

  it.each([
    ["좋음", "display", "text-[clamp(28px,9vw,56px)]"],
    ["매우 좋음", "large", "text-[clamp(24px,7.5vw,48px)]"],
    ["함께 하면 일이 쉬워진다", "medium", "text-[clamp(20px,6vw,40px)]"],
    [
      "Friend Soon-ja and neighbor Jeong-hee",
      "compact",
      "text-[clamp(17px,4.8vw,32px)]",
    ],
  ])(
    "sizes the %s tile label with the %s older-adult typography band",
    (label, size, fontSizeClass) => {
      render(
        <ChoiceCard
          id="a"
          label={label}
          state="idle"
          onSelect={vi.fn()}
          layout="tile"
        />,
      );

      expect(screen.getByText(label)).toHaveAttribute(
        "data-choice-label-size",
        size,
      );
      expect(screen.getByText(label)).toHaveClass(
        fontSizeClass,
        "block",
        "font-extrabold",
        "w-full",
        "[text-wrap:balance]",
        "[overflow-wrap:anywhere]",
      );
      if (size === "display") {
        expect(screen.getByText(label)).toHaveClass("!whitespace-nowrap");
      } else {
        expect(screen.getByText(label)).not.toHaveClass("!whitespace-nowrap");
      }
    },
  );

  it("keeps a tile typography band anchored to its unnumbered label", () => {
    render(
      <ChoiceCard
        id="a"
        label="1. 열쇠"
        labelSizeReference="열쇠"
        state="selected"
        onSelect={vi.fn()}
        layout="tile"
      />,
    );

    expect(screen.getByText("1. 열쇠")).toHaveAttribute(
      "data-choice-label-size",
      "display",
    );
  });

  it("plays the select cue before forwarding a choice", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceCard id="apple" label="사과" state="idle" onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "사과" }));

    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledWith("select");
    expect(onSelect).toHaveBeenCalledWith("apple");
  });
});
