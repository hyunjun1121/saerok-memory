import { describe, expect, it } from "vitest";
import {
  getHaruNavigationRenderLatency,
  hashTelemetryContent,
} from "@/features/analytics/client";

describe("analytics client helpers", () => {
  it("creates deterministic opaque content hashes from coded identifiers", () => {
    expect(hashTelemetryContent("D1_Q1", "jp-2026.08")).toBe(
      hashTelemetryContent("D1_Q1", "jp-2026.08"),
    );
    expect(hashTelemetryContent("D1_Q1", "jp-2026.08")).not.toBe(
      hashTelemetryContent("D1_Q1", "kr-2026.08"),
    );
    expect(hashTelemetryContent("D1_Q1", "jp-2026.08")).toMatch(
      /^fnv1a-[a-f0-9]{8}$/u,
    );
  });

  it("derives a bounded render latency from navigation timing without page content", () => {
    expect(
      getHaruNavigationRenderLatency({
        getEntriesByType: () => [
          {
            startTime: 100,
            domContentLoadedEventEnd: 875.4,
          } as unknown as PerformanceEntry,
        ],
      }),
    ).toBe(775);
    expect(
      getHaruNavigationRenderLatency({ getEntriesByType: () => [] }),
    ).toBeNull();
  });
});
