import { beforeEach, describe, expect, it, vi } from "vitest";
import { TelemetryBatchClient } from "@/features/analytics/batchClient";
import { MemoryOutboxStore, TelemetryOutbox } from "@/features/analytics/outbox";
import { HaruTelemetryRuntime } from "@/features/analytics/runtime";
import type { TelemetryEnvelope } from "@/features/analytics/types";
import type { HaruConsentState } from "@/features/profile/haruConsentStorage";

const grantedConsent: HaruConsentState = {
  usageAnalytics: true,
  voiceRecording: false,
  sttProcessing: false,
  transcriptStorage: false,
  audioStorage: false,
  longitudinalUsageStorage: true,
  personalizedQuestionUse: false,
  familySharing: false,
  consentedAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Haru telemetry runtime", () => {
  let consent = grantedConsent;
  let outbox: TelemetryOutbox;

  beforeEach(() => {
    localStorage.clear();
    consent = grantedConsent;
    outbox = new TelemetryOutbox(new MemoryOutboxStore(), { now: () => 1_000 });
  });

  function createRuntime() {
    return new HaruTelemetryRuntime({
      config: {
        market: "jp",
        language: "ja",
        locale: "ja-JP",
        timeZone: "Asia/Tokyo",
        currency: "JPY",
        speechLanguage: "ja-JP",
        contentPackVersion: "jp-2026.08",
        lockedLanguage: true,
      },
      getConsent: () => consent,
      outbox,
      batchClient: new TelemetryBatchClient(outbox, {
        send: vi.fn(async (events: readonly TelemetryEnvelope[]) => ({
          acceptedEventIds: events.map(({ eventId }) => eventId),
        })),
      }),
      now: () => new Date("2026-08-06T00:00:00.000Z"),
      getRoute: () => "/lesson?day=1",
      installationId: "inst_jp_00112233445566778899aabbccddeeff",
      visitId: "visit_00112233445566778899aabbccddeeff",
      createEventId: () => "evt_jp_00112233445566778899aabbccddeeff",
      appVersion: "1.0.0",
    });
  }

  it("records only allowlisted codes and strips route query data", async () => {
    const runtime = createRuntime();

    await expect(
      runtime.capture("question_presented", {
        questionId: "D1_Q1",
        exerciseType: "haru_scenario",
        domain: "orientation",
        ordinal: 1,
        difficulty: "1",
        questionContentVersion: "jp-2026.08",
        questionContentHash: "fnv1a-abcd1234",
      }),
    ).resolves.toBe(true);

    expect(await runtime.listPendingEvents()).toEqual([
      expect.objectContaining({
        market: "jp",
        locale: "ja-JP",
        routeId: "/lesson",
        eventName: "question_presented",
        sequence: 1,
      }),
    ]);
  });

  it("fails closed when usage analytics consent is absent", async () => {
    consent = { ...grantedConsent, usageAnalytics: false };
    const runtime = createRuntime();

    await expect(
      runtime.capture("app_opened", { launchKind: "fresh", online: true }),
    ).resolves.toBe(false);
    expect(await runtime.listPendingEvents()).toHaveLength(0);
  });

  it("keeps product telemetry but suppresses activity telemetry without longitudinal consent", async () => {
    consent = { ...grantedConsent, longitudinalUsageStorage: false };
    const runtime = createRuntime();

    await expect(
      runtime.capture("app_opened", { launchKind: "returning", online: true }),
    ).resolves.toBe(true);
    await expect(
      runtime.capture("answer_confirmed", {
        inputMode: "touch",
        responseIds: ["A"],
        result: "correct",
        responseTimeMs: 1000,
        activeResponseTimeMs: 900,
        selectionChangeCount: 1,
      }),
    ).resolves.toBe(false);
    expect(await runtime.listPendingEvents()).toHaveLength(1);
  });

  it("clears pending events immediately after withdrawal", async () => {
    const runtime = createRuntime();
    await runtime.capture("app_opened", { launchKind: "fresh", online: true });
    expect(await runtime.listPendingEvents()).toHaveLength(1);

    consent = { ...grantedConsent, usageAnalytics: false };
    await runtime.handleConsentChanged();

    expect(await runtime.listPendingEvents()).toHaveLength(0);
  });
});
