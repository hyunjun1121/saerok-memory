import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VoiceWaveform } from "@/features/speech/VoiceWaveform";

function getBars(): HTMLElement[] {
  return Array.from(
    screen.getByRole("img", { name: "voice activity" }).querySelectorAll("span"),
  );
}

describe("VoiceWaveform", () => {
  it("uses calm brand bars while idle and red reactive bars while recording", () => {
    const { rerender } = render(
      <VoiceWaveform levels={[0.2, 0.8]} active={false} ariaLabel="voice activity" />,
    );

    expect(getBars()).toHaveLength(2);
    getBars().forEach((bar) => expect(bar).toHaveClass("bg-primary-500"));

    rerender(
      <VoiceWaveform levels={[0.2, 0.8]} active ariaLabel="voice activity" />,
    );

    getBars().forEach((bar) => {
      expect(bar).toHaveClass("bg-red-500");
      expect(bar).toHaveStyle({ animationName: "equalizer", opacity: "1" });
    });
  });

  it("keeps an explicit bar color override", () => {
    render(
      <VoiceWaveform
        levels={[0.5]}
        active
        barClassName="bg-blue-500"
        ariaLabel="voice activity"
      />,
    );

    expect(getBars()[0]).toHaveClass("bg-blue-500");
    expect(getBars()[0]).not.toHaveClass("bg-red-500");
  });
});
