import { render, waitFor } from "@testing-library/react";
import { VoiceAmplitude } from "@/features/lesson/VoiceAmplitude";

describe("VoiceAmplitude", () => {
  it("uses deterministic visual fallback when microphone access is unavailable", async () => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const { container } = render(<VoiceAmplitude active fallbackLabel="fallback" />);
    await waitFor(() => expect(container.querySelector(".voice-waveform")).toHaveAttribute("data-fallback", "true"));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: original });
  });

  it("does not request microphone access while inactive", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    render(<VoiceAmplitude active={false} fallbackLabel="fallback" />);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
