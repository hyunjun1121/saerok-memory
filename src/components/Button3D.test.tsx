import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button3D } from "@/components/Button3D";
import "@/i18n";

// SP-04 step 1: every Button3D tap fires the soft tap tone (unless disabled).
vi.mock("@/hooks/interactionFeedback", () => ({
  playInteractionCue: vi.fn(() => Promise.resolve()),
  playSoftTapTone: vi.fn(),
  playSoftSuccessTone: vi.fn(),
  vibrateLightly: vi.fn(),
  speakCalmly: vi.fn(),
}));

import { playInteractionCue } from "@/hooks/interactionFeedback";

/**
 * SP-02: high-contrast warm palette for presbyopia.
 * Asserts that the legacy low-luminance green/blue/red fills with white text
 * (which fail WCAG AA) are gone from the core CTA variants, and that the new
 * warm AA-pass fills are applied.
 * Contrast (white text): amber-700 #b35900 = 4.84:1 PASS, red-600 #d6332a = 4.81:1 PASS.
 * Secondary ink #2b2f33 on surface-warm #fffaf0 = 12.97:1 AAA.
 */
describe("Button3D SP-02 high-contrast palette", () => {
  it("primary uses amber-700 fill + amber-800 border, not low-luminance green", () => {
    render(<Button3D variant="primary">계속</Button3D>);
    const btn = screen.getByRole("button", { name: "계속" });
    expect(btn.className).toContain("bg-amber-700");
    expect(btn.className).toContain("border-amber-800");
    expect(btn.className).toContain("text-white");
    // Legacy fail combo must be gone.
    expect(btn.className).not.toContain("bg-primary-500");
  });

  it("secondary uses ink text on warm surface, not white-on-blue", () => {
    render(<Button3D variant="secondary">건너뛰기</Button3D>);
    const btn = screen.getByRole("button", { name: "건너뛰기" });
    expect(btn.className).toContain("text-ink");
    expect(btn.className).toContain("bg-[var(--color-surface-warm)]");
    // Legacy fail combo must be gone.
    expect(btn.className).not.toContain("bg-blue-500");
  });

  it("danger uses red-600 fill, not red-500", () => {
    render(<Button3D variant="danger">다시</Button3D>);
    const btn = screen.getByRole("button", { name: "다시" });
    expect(btn.className).toContain("bg-red-600");
    expect(btn.className).toContain("text-white");
    expect(btn.className).not.toContain("bg-red-500");
  });
});

describe("Button3D semantic feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("plays confirm by default and forwards onClick", () => {
    const onClick = vi.fn();
    render(<Button3D variant="primary" onClick={onClick}>계속</Button3D>);
    fireEvent.click(screen.getByRole("button", { name: "계속" }));
    expect(playInteractionCue).toHaveBeenCalledWith("confirm");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports explicit silent actions such as speech replay", () => {
    render(<Button3D feedbackCue="none">문장 듣기</Button3D>);
    fireEvent.click(screen.getByRole("button", { name: "문장 듣기" }));
    expect(playInteractionCue).not.toHaveBeenCalled();
  });

  it("does not play feedback when disabled", () => {
    render(<Button3D variant="disabled">계속</Button3D>);
    fireEvent.click(screen.getByRole("button", { name: "계속" }));
    expect(playInteractionCue).not.toHaveBeenCalled();
  });

  it("SP-03: exposes aria-pressed only when pressed is true", () => {
    const { rerender } = render(<Button3D variant="primary" pressed>토글</Button3D>);
    expect(screen.getByRole("button", { name: "토글" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    rerender(<Button3D variant="primary" pressed={false}>토글</Button3D>);
    expect(screen.getByRole("button", { name: "토글" })).not.toHaveAttribute(
      "aria-pressed",
    );
  });
});
