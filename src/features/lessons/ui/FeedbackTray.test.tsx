import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { FeedbackTray } from "@/features/lessons/ui/FeedbackTray";
import "@/i18n";

// Centralized success cue (SP-04 step 2): the success tone must fire exactly
// when the tray mounts as the "correct" variant, and never for other variants.
vi.mock("@/hooks/interactionFeedback", () => ({
  playSoftTapTone: vi.fn(),
  playSoftSuccessTone: vi.fn(),
  vibrateLightly: vi.fn(),
  speakCalmly: vi.fn(),
}));

import { playSoftSuccessTone } from "@/hooks/interactionFeedback";

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
    expect(playSoftSuccessTone).toHaveBeenCalledTimes(1);
  });

  it("does not fire the success cue for incorrect variant", () => {
    render(
      <FeedbackTray
        variant="incorrect"
        title="조금 아쉬워요"
        primaryActionLabel="다시 해볼까요?"
        onPrimaryAction={vi.fn()}
      />,
    );
    expect(playSoftSuccessTone).not.toHaveBeenCalled();
  });
});
