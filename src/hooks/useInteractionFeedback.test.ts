import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSoundFeedbackEnabled } from "@/features/profile/learnerProfileStorage";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";

const feedbackMocks = vi.hoisted(() => ({
  playInteractionCue: vi.fn(() => Promise.resolve()),
  playSoftTapTone: vi.fn(),
  playSoftSuccessTone: vi.fn(),
  speakCalmly: vi.fn(),
  vibrateLightly: vi.fn(),
}));

vi.mock("@/hooks/interactionFeedback", () => feedbackMocks);

describe("useInteractionFeedback", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("gates effects and haptics behind the learner feedback setting", async () => {
    setSoundFeedbackEnabled(false);
    const { result } = renderHook(() => useInteractionFeedback());

    await act(async () => {
      await result.current.playCue("select");
    });

    expect(feedbackMocks.playInteractionCue).not.toHaveBeenCalled();
    expect(feedbackMocks.vibrateLightly).not.toHaveBeenCalled();
  });

  it("plays a typed cue and matching haptic when feedback is enabled", async () => {
    setSoundFeedbackEnabled(true);
    const { result } = renderHook(() => useInteractionFeedback());

    await act(async () => {
      await result.current.playCue("routineComplete");
    });

    expect(feedbackMocks.playInteractionCue).toHaveBeenCalledWith("routineComplete");
    expect(feedbackMocks.vibrateLightly).toHaveBeenCalledWith([18, 40, 18]);
  });

  it("keeps explicit speech available when optional effects are off", () => {
    setSoundFeedbackEnabled(false);
    const { result } = renderHook(() => useInteractionFeedback());

    act(() => {
      result.current.speak("천천히 들어보세요", "ko-KR");
    });

    expect(feedbackMocks.speakCalmly).toHaveBeenCalledWith(
      "천천히 들어보세요",
      "ko-KR",
    );
  });
});
