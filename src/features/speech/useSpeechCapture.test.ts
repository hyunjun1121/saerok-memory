import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechCapture } from "@/features/speech/useSpeechCapture";

describe("useSpeechCapture", () => {
  beforeEach(() => {
    // jsdom ships no SpeechRecognition — mirrors unsupported browsers.
    // Ensure a clean state even if another test injected a mock.
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("reports unsupported and never throws when SpeechRecognition is absent", () => {
    const { result } = renderHook(() => useSpeechCapture("ko"));

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isListening).toBe(false);

    act(() => {
      // start() must be a safe no-op on unsupported browsers; the routine stays
      // completable without speech (SP-04 browser-API requirement).
      expect(() => result.current.start()).not.toThrow();
    });

    expect(result.current.isListening).toBe(false);
  });

  it("SP-05: exposes audioAssetUrl initial null on unsupported browsers", () => {
    const { result } = renderHook(() => useSpeechCapture("ko"));
    expect(result.current.audioAssetUrl).toBeNull();

    // start() must still not throw or set listening without any media source.
    act(() => {
      expect(() => result.current.start()).not.toThrow();
    });
    expect(result.current.audioAssetUrl).toBeNull();
  });
});
