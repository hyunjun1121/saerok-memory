import { createTelemetryEnvelope, type TelemetryCommonFields } from "@/features/analytics/types";
import {
  redactTelemetryDiagnostic,
  validateTelemetryEnvelope,
} from "@/features/analytics/privacy";

const common: Omit<TelemetryCommonFields, "schemaVersion"> = {
  eventId: "evt_kr_00112233445566778899aabbccddeeff",
  occurredAt: "2026-08-06T03:00:00.000Z",
  sequence: 1,
  market: "kr",
  locale: "ko-KR",
  appVersion: "1.0.0",
  contentPackVersion: "kr-2026.08.1",
  installationId: "inst_kr_00112233445566778899aabbccddeeff",
  visitId: "visit_00112233445566778899aabbccddeeff",
  routeId: "/lesson",
  consentRevision: "2026-08-01",
};

describe("telemetry privacy gate", () => {
  it("accepts an allowlisted semantic event", () => {
    const event = createTelemetryEnvelope(common, {
      eventName: "choice_changed",
      payload: {
        actionId: "choice_2",
        selectionState: "selected",
        selectionCount: 1,
        changeIndex: 2,
      },
    });

    expect(validateTelemetryEnvelope(event)).toEqual({ ok: true, event });
  });

  it("accepts voice capture as an independent consent category", () => {
    const event = createTelemetryEnvelope(common, {
      eventName: "consent_changed",
      payload: {
        category: "voice_capture",
        granted: false,
        source: "settings",
      },
    });

    expect(validateTelemetryEnvelope(event)).toEqual({ ok: true, event });
  });

  it("accepts only coded voice-experience metadata without voice content", () => {
    const event = createTelemetryEnvelope(common, {
      eventName: "voice_capture_status",
      payload: {
        phase: "completed",
        permission: "granted",
        durationMs: 12_000,
        sttStatus: "completed",
        sttLatencyMs: 900,
        noSpeech: false,
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        guidanceCopyVersion: "voice-guidance-2026-08-v2",
        sttPipelineVersion: "haru-qwen3-asr-v2",
        outcomeReason: "completed",
      },
    });

    expect(validateTelemetryEnvelope(event)).toEqual({ ok: true, event });
  });

  it("accepts coded voice exposure metadata before recording begins", () => {
    const event = createTelemetryEnvelope(common, {
      eventName: "question_presented",
      payload: {
        questionId: "D1_Q5",
        exerciseType: "voice",
        domain: "daily_memory",
        ordinal: 5,
        difficulty: "1",
        questionContentVersion: "kr-2026.08",
        questionContentHash: "fnv1a-voice0001",
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        guidanceCopyVersion: "voice-guidance-2026-08-v2",
      },
    });

    expect(validateTelemetryEnvelope(event)).toEqual({ ok: true, event });
  });

  it("rejects unknown voice variants and outcome reasons", () => {
    const base = createTelemetryEnvelope(common, {
      eventName: "voice_capture_status",
      payload: { phase: "failed" },
    });

    for (const payload of [
      { phase: "failed", voiceExperienceVariant: "secret_experiment" },
      { phase: "failed", outcomeReason: "user said private words" },
    ]) {
      expect(validateTelemetryEnvelope({ ...base, payload }).ok).toBe(false);
    }

    const presentation = createTelemetryEnvelope(common, {
      eventName: "question_presented",
      payload: {
        questionId: "D1_Q5",
        exerciseType: "voice",
        domain: "daily_memory",
        ordinal: 5,
        difficulty: "1",
        questionContentVersion: "kr-2026.08",
        questionContentHash: "fnv1a-voice0001",
      },
    });
    expect(
      validateTelemetryEnvelope({
        ...presentation,
        payload: {
          ...presentation.payload,
          voiceExperienceVariant: "private_cohort",
        },
      }).ok,
    ).toBe(false);
  });

  it.each(["transcript", "prompt", "name", "email", "phone", "address", "audioBlob"])(
    "rejects sensitive payload field %s",
    (field) => {
      const event = {
        ...createTelemetryEnvelope(common, {
          eventName: "choice_changed",
          payload: {
            actionId: "choice_2",
            selectionState: "selected",
            selectionCount: 1,
            changeIndex: 2,
          },
        }),
        payload: {
          actionId: "choice_2",
          selectionState: "selected",
          selectionCount: 1,
          changeIndex: 2,
          [field]: "private value",
        },
      };

      const result = validateTelemetryEnvelope(event);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain(field);
      }
    },
  );

  it("rejects unknown fields and free-text values even under an allowed key", () => {
    const event = {
      ...createTelemetryEnvelope(common, {
        eventName: "client_error",
        payload: { source: "stt", code: "network_timeout", recoverable: true },
      }),
      payload: {
        source: "stt",
        code: "My daughter lives at 14 Main Street",
        recoverable: true,
      },
      debugMessage: "raw failure body",
    };

    const result = validateTelemetryEnvelope(event);
    expect(result.ok).toBe(false);
  });

  it("redacts sensitive keys and contact-shaped strings in diagnostics", () => {
    expect(
      redactTelemetryDiagnostic({
        email: "person@example.com",
        nested: { transcript: "private story", code: "safe_code" },
        value: "010-1234-5678",
      }),
    ).toEqual({
      email: "[REDACTED]",
      nested: { transcript: "[REDACTED]", code: "safe_code" },
      value: "[REDACTED]",
    });
  });
});
