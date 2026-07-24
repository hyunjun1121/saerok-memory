import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { FeedbackTray } from "@/features/lessons/ui/FeedbackTray";
import "@/i18n";

// Centralized success cue (SP-04 step 2): the success tone must fire exactly
// when the tray mounts as the "correct" variant, and never for other variants.
vi.mock("@/hooks/interactionFeedback", () => ({
  playInteractionCue: vi.fn(() => Promise.resolve()),
  playSoftTapTone: vi.fn(),
  playSoftSuccessTone: vi.fn(),
  vibrateLightly: vi.fn(),
  speakCalmly: vi.fn(),
}));

import { playInteractionCue } from "@/hooks/interactionFeedback";

describe("FeedbackTray SP-04 success centralization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("fires the success cue when variant is correct", () => {
    render(
      <FeedbackTray
        variant="correct"
        title="잘하셨어요!"
        primaryActionLabel="계속하기"
        onPrimaryAction={vi.fn()}
      />,
    );
    expect(playInteractionCue).toHaveBeenCalledWith("success");
  });

  it.each(["incorrect", "hint"] as const)(
    "fires the retry cue for %s feedback",
    (variant) => {
      render(
        <FeedbackTray
          variant={variant}
          title="한 번 더 살펴봐요"
          primaryActionLabel="다시 해볼까요?"
          onPrimaryAction={vi.fn()}
        />,
      );
      expect(playInteractionCue).toHaveBeenCalledWith("retry");
    },
  );

  it("does not play an automatic cue for neutral feedback", () => {
    render(
      <FeedbackTray
        variant="neutral"
        title="다음으로 갈까요?"
        primaryActionLabel="계속하기"
        onPrimaryAction={vi.fn()}
      />,
    );
    expect(playInteractionCue).not.toHaveBeenCalled();
  });
});
