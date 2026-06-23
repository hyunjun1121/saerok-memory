import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SpeechCapturePanel } from "./SpeechCapturePanel";

describe("SpeechCapturePanel SP-05 waveform", () => {
  it("renders a multi-bar waveform (role=img, 5 bars) while listening", () => {
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
      />,
    );

    const waveform = container.querySelector('[role="img"]');
    expect(waveform).not.toBeNull();
    expect(waveform?.children.length).toBe(5);
  });
});
