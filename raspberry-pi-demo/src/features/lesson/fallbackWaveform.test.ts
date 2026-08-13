import { createFallbackVoiceFrame } from "@/features/lesson/fallbackWaveform";

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("fallback voice waveform", () => {
  it("creates deterministic speech-like bursts, pauses, and spatial variation", () => {
    const timestamps = [0, 180, 360, 540, 760, 980, 1_240, 1_620, 2_040, 2_480, 3_040, 3_720, 4_460, 5_280];
    const frames = timestamps.map((time) => createFallbackVoiceFrame(time, 19));

    expect(createFallbackVoiceFrame(1_240, 19)).toEqual(createFallbackVoiceFrame(1_240, 19));
    expect(frames.every((frame) => frame.length === 19)).toBe(true);
    expect(frames.flat().every((value) => value >= 0.08 && value <= 1)).toBe(true);

    const signatures = new Set(frames.map((frame) => frame.map((value) => value.toFixed(3)).join(",")));
    expect(signatures.size).toBeGreaterThanOrEqual(10);
    expect(Math.min(...frames.map(mean))).toBeLessThan(0.22);
    expect(Math.max(...frames.map(mean))).toBeGreaterThan(0.42);
    expect(frames.filter((frame) => Math.max(...frame) - Math.min(...frame) > 0.25).length)
      .toBeGreaterThanOrEqual(8);
  });
});
