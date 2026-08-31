import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchHaruRemoteExport,
  getHaruRemoteDeletionStatus,
  requestHaruRemoteDeletion,
  requestHaruRemoteExport,
  submitHaruActivitySession,
  submitHaruConsentReceipt,
  submitHaruQuestionAttempt,
} from "@/features/profile/haruDataApi";
import type { HaruConsentState } from "@/features/profile/haruConsentStorage";

const consent: HaruConsentState = {
  usageAnalytics: true,
  voiceRecording: false,
  sttProcessing: true,
  transcriptStorage: false,
  audioStorage: false,
  longitudinalUsageStorage: true,
  personalizedQuestionUse: true,
  familySharing: false,
  consentedAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

function seedEnrollment() {
  localStorage.setItem(
    "haru:jp:enrollment",
    JSON.stringify({
      participantId: "018f0f65-4f93-7cc0-9d41-4e63c8412863",
      market: "jp",
      locale: "ja-JP",
      enrolledAt: "2026-08-06T00:00:00.000Z",
    }),
  );
}

describe("Haru data API client", () => {
  beforeEach(() => localStorage.clear());

  it("submits voice capture independently from STT and retention grants", async () => {
    seedEnrollment();
    const fetchImplementation = vi.fn(async () => new Response("{}", { status: 202 }));

    await expect(
      submitHaruConsentReceipt(consent, {
        market: "jp",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).resolves.toBe(true);

    const fetchCalls = fetchImplementation.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit]
    >;
    const init = fetchCalls[0][1];
    expect(JSON.parse(String(init.body))).toEqual({
      revision: "consent-1785974400000",
      occurredAt: "2026-08-06T00:00:00.000Z",
      grants: {
        usageAnalytics: true,
        longitudinalActivity: true,
        voiceCapture: false,
        sttProcessing: true,
        transcriptStorage: false,
        audioStorage: false,
        personalization: true,
        familySharing: false,
      },
    });
    expect(init).toMatchObject({ credentials: "same-origin", method: "POST" });
  });

  it("does not call remote APIs before pseudonymous enrollment", async () => {
    const fetchImplementation = vi.fn();
    await expect(
      submitHaruConsentReceipt(consent, {
        market: "kr",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).resolves.toBe(false);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("sends coded activity session and question-attempt records", async () => {
    seedEnrollment();
    const fetchImplementation = vi.fn(async () => new Response("{}", { status: 202 }));
    const options = {
      market: "jp" as const,
      fetchImplementation: fetchImplementation as typeof fetch,
    };

    await expect(
      submitHaruActivitySession(
        {
          sessionId: "routine_00112233445566778899aabbccddeeff",
          state: "started",
          occurredAt: "2026-08-06T00:00:00.000Z",
          contentPackVersion: "jp-2026.08",
          consentRevision: "consent-1785974400000",
          progressPercent: 0,
          activeDurationMs: 0,
          wallDurationMs: 0,
        },
        options,
      ),
    ).resolves.toBe(true);
    await expect(
      submitHaruQuestionAttempt(
        {
          sessionId: "routine_00112233445566778899aabbccddeeff",
          questionInstanceId: "question_00112233445566778899aabbccddeeff",
          questionId: "D1_Q1",
          questionType: "single_choice",
          contentPackVersion: "jp-2026.08",
          presentedAt: "2026-08-06T00:00:00.000Z",
          completedAt: "2026-08-06T00:00:04.000Z",
          activeDurationMs: 3210,
          wallDurationMs: 4000,
          firstInteractionMs: 900,
          confirmationLatencyMs: 1200,
          response: {
            selectedOptionIds: ["A"],
            isCorrect: true,
            retryCount: 0,
            hintCount: 0,
          },
        },
        options,
      ),
    ).resolves.toBe(true);

    const fetchCalls = fetchImplementation.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit]
    >;
    expect(fetchCalls.map(([path]) => path)).toEqual([
      "/api/activity/v1/sessions",
      "/api/activity/v1/question-attempts",
    ]);
  });

  it("requests remote export and idempotent deletion categories", async () => {
    seedEnrollment();
    const fetchImplementation = vi.fn(async () =>
      new Response(JSON.stringify({ requestId: "request-1", status: "queued" }), {
        status: 202,
      }),
    );
    const options = {
      market: "jp" as const,
      fetchImplementation: fetchImplementation as typeof fetch,
    };

    await expect(requestHaruRemoteExport(["sessions", "telemetry"], options)).resolves.toBe(
      true,
    );
    await expect(
      requestHaruRemoteDeletion(
        "018f0f65-4f93-7cc0-9d41-4e63c8412869",
        ["all"],
        options,
      ),
    ).resolves.toBe(true);
  });

  it("returns a validated server export for the enrolled market", async () => {
    seedEnrollment();
    const fetchImplementation = vi.fn(async () =>
      new Response(
        JSON.stringify({
          schemaVersion: "1.0",
          market: "jp",
          generatedAt: "2026-08-06T00:00:00.000Z",
          data: { sessions: [{ sessionId: "session-1" }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      fetchHaruRemoteExport(["sessions"], {
        market: "jp",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).resolves.toEqual({
      schemaVersion: "1.0",
      market: "jp",
      generatedAt: "2026-08-06T00:00:00.000Z",
      data: { sessions: [{ sessionId: "session-1" }] },
    });
  });

  it("rejects cross-market export payloads and reads deletion status", async () => {
    seedEnrollment();
    const mismatchFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          schemaVersion: "1.0",
          market: "kr",
          generatedAt: "2026-08-06T00:00:00.000Z",
          data: {},
        }),
        { status: 200 },
      ),
    );
    await expect(
      fetchHaruRemoteExport(["sessions"], {
        market: "jp",
        fetchImplementation: mismatchFetch as typeof fetch,
      }),
    ).resolves.toBeNull();

    const requestId = "018f0f65-4f93-7cc0-9d41-4e63c8412869";
    const statusFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          requestId,
          status: "completed",
          requestedAt: "2026-08-06T00:00:00.000Z",
          completedAt: "2026-08-06T00:00:02.000Z",
        }),
        { status: 200 },
      ),
    );
    await expect(
      getHaruRemoteDeletionStatus(requestId, {
        market: "jp",
        fetchImplementation: statusFetch as typeof fetch,
      }),
    ).resolves.toEqual({
      requestId,
      status: "completed",
      requestedAt: "2026-08-06T00:00:00.000Z",
      completedAt: "2026-08-06T00:00:02.000Z",
    });
    expect(statusFetch).toHaveBeenCalledWith(
      `/api/privacy/v1/deletions/${requestId}`,
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });
});
