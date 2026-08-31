import {
  createTelemetryEnvelope,
  getTelemetryDataClass,
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryCommonFields,
} from "@/features/analytics/types";

const common: Omit<TelemetryCommonFields, "schemaVersion"> = {
  eventId: "evt_kr_00112233445566778899aabbccddeeff",
  occurredAt: "2026-08-06T03:00:00.000Z",
  sequence: 7,
  market: "kr",
  locale: "ko-KR",
  appVersion: "1.2.3",
  contentPackVersion: "kr-2026.08.1",
  installationId: "inst_kr_00112233445566778899aabbccddeeff",
  visitId: "visit_00112233445566778899aabbccddeeff",
  routineSessionId: "routine_00112233445566778899aabbccddeeff",
  questionInstanceId: "question_instance_7",
  routeId: "/lesson",
  consentRevision: "2026-08-01",
};

describe("telemetry types", () => {
  it("builds a correlated discriminated envelope", () => {
    const event = createTelemetryEnvelope(common, {
      eventName: "question_presented",
      payload: {
        questionId: "D1_Q1",
        exerciseType: "orientation_practice",
        domain: "orientation",
        ordinal: 1,
        difficulty: "baseline",
        questionContentVersion: "jp-2026.08.1",
        questionContentHash: "sha256_aabbccdd",
      },
    });

    expect(event.schemaVersion).toBe(TELEMETRY_SCHEMA_VERSION);
    expect(event.eventName).toBe("question_presented");
    expect(event.payload.questionId).toBe("D1_Q1");
  });

  it("classifies product, activity, and audit events", () => {
    expect(getTelemetryDataClass("route_viewed")).toBe("product");
    expect(getTelemetryDataClass("answer_confirmed")).toBe("activity");
    expect(getTelemetryDataClass("report_viewed")).toBe("access_audit");
  });
});
