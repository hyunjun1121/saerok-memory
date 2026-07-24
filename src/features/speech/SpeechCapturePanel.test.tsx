import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SpeechCapturePanel } from "@/features/speech/SpeechCapturePanel";

const feedbackMocks = vi.hoisted(() => ({
  playInteractionCue: vi.fn(async (cue: string) => {
    void cue;
  }),
  speakCalmly: vi.fn(),
  vibrateLightly: vi.fn(),
}));

vi.mock("@/hooks/interactionFeedback", () => feedbackMocks);

describe("SpeechCapturePanel SP-05 waveform", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders a reactive multi-bar waveform (role=img) while listening", () => {
    const { container } = render(
      <SpeechCapturePanel
        isSupported
        isListening
        onStart={() => {}}
        onStop={() => {}}
        startLabel="말하기 시작"
        stopLabel="말하기 마치기"
        listeningTitle="듣고 있어요"
        listeningBody="천천히 말씀해 주세요."
        unsupportedNote="지원되지 않음"
        durationHint="20초 정도"
        levels={[]}
      />,
    );

    const waveform = container.querySelector('[role="img"]');
    expect(waveform).not.toBeNull();
    // With no mic data yet, VoiceWaveform falls back to 24 resting bars.
    expect(waveform?.children.length).toBe(24);
  });

  it("delegates recording boundaries without stacking a generic button cue", () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const props = {
      isSupported: true,
      onStart,
      onStop,
      startLabel: "말하기 시작",
      stopLabel: "말하기 마치기",
      listeningTitle: "듣고 있어요",
      listeningBody: "천천히 말씀해 주세요.",
      unsupportedNote: "지원되지 않음",
    };
    const { rerender } = render(
      <SpeechCapturePanel {...props} isListening={false} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "말하기 시작" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(feedbackMocks.playInteractionCue).not.toHaveBeenCalled();

    rerender(<SpeechCapturePanel {...props} isListening />);
    fireEvent.click(screen.getByRole("button", { name: "말하기 마치기" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(feedbackMocks.playInteractionCue).not.toHaveBeenCalled();
  });
});
