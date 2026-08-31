import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildHaruLocalDataExport,
  buildHaruLocalDataExportWithTelemetry,
  downloadHaruLocalDataExport,
  downloadHaruRemoteDataExport,
  serializeHaruLocalDataExport,
} from "@/features/profile/haruDataExport";

describe("Haru local data export", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exports every local data category with market and timestamp", () => {
    localStorage.setItem(
      "caregiverObservationRecords",
      JSON.stringify([
        {
          id: "obs-1",
          createdAt: "2026-08-01T00:00:00.000Z",
          selectedDomains: ["dailyRoutine"],
          domainResponses: { dailyRoutine: "occasionallyDifferent" },
          note: "가족 메모",
        },
      ]),
    );

    const result = buildHaruLocalDataExport(
      new Date("2026-08-06T01:02:03.000Z"),
      "jp",
    );

    expect(result).toEqual(
      expect.objectContaining({
        schemaVersion: "1.0",
        exportedAt: "2026-08-06T01:02:03.000Z",
        market: "jp",
        consent: expect.any(Object),
        profile: expect.any(Object),
        sessions: expect.any(Array),
        activityRecord: null,
        cognitiveResults: expect.any(Array),
        memoryCards: expect.any(Array),
        caregiverObservations: [expect.objectContaining({ id: "obs-1" })],
      }),
    );
  });

  it("serializes without embedding Blob contents", () => {
    const serialized = serializeHaruLocalDataExport({
      schemaVersion: "1.0",
      exportedAt: "2026-08-06T01:02:03.000Z",
      market: "kr",
      consent: {},
      profile: {},
      sessions: [],
      activityRecord: { audio: new Blob(["private"], { type: "audio/webm" }) },
      cognitiveResults: [],
      memoryCards: [],
      caregiverObservations: [],
      weeklyReward: {},
      telemetry: [],
    });

    expect(serialized).toContain('"omitted": true');
    expect(serialized).not.toContain("private");
  });

  it("includes the privacy-safe telemetry outbox in the asynchronous export", async () => {
    const result = await buildHaruLocalDataExportWithTelemetry(
      new Date("2026-08-06T01:02:03.000Z"),
      "kr",
      async () => [{ eventName: "app_opened", payload: { online: true } }],
    );

    expect(result.telemetry).toEqual([
      { eventName: "app_opened", payload: { online: true } },
    ]);
  });

  it("downloads the asynchronous export and always revokes its object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:haru-export");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const downloaded = await downloadHaruLocalDataExport(
      new Date("2026-08-06T01:02:03.000Z"),
      "jp",
      async () => [{ eventName: "app_opened" }],
    );

    expect(downloaded).toBe(true);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:haru-export");
  });

  it("does not download an incomplete export when telemetry loading fails", async () => {
    const createObjectURL = vi.fn(() => "blob:haru-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const downloaded = await downloadHaruLocalDataExport(
      new Date("2026-08-06T01:02:03.000Z"),
      "kr",
      async () => {
        throw new Error("IndexedDB unavailable");
      },
    );

    expect(downloaded).toBe(false);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("downloads a validated server export as a separate market-scoped file", () => {
    const createObjectURL = vi.fn(() => "blob:haru-server-export");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const downloaded = downloadHaruRemoteDataExport({
      schemaVersion: "1.0",
      market: "jp",
      generatedAt: "2026-08-06T01:02:03.000Z",
      data: { sessions: [] },
    });

    expect(downloaded).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "haru-server-data-jp-2026-08-06.json",
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:haru-server-export");
  });
});
