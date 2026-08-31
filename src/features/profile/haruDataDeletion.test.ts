import { beforeEach, describe, expect, it, vi } from "vitest";
import { HARU_CONSENT_STORAGE_KEY } from "@/features/profile/haruConsentStorage";
import { clearHaruLocalParticipantData } from "@/features/profile/haruDataDeletion";

const mocks = vi.hoisted(() => ({
  clearAdminRecords: vi.fn(async () => undefined),
  clearSttQueue: vi.fn(async () => true as boolean | void),
  clearSttRetry: vi.fn(() => true),
  clearRagOutbox: vi.fn(() => true),
  clearDemoSessions: vi.fn(() => true),
  clearCognitive: vi.fn(() => true),
  clearMemory: vi.fn(() => true),
  clearCaregiver: vi.fn(() => undefined),
  clearTelemetry: vi.fn(async () => undefined),
  stopTelemetry: vi.fn(() => undefined),
  resetWeeklyRewards: vi.fn(() => undefined),
}));

vi.mock("@/features/analytics/client", () => ({
  clearHaruTelemetry: mocks.clearTelemetry,
  stopHaruTelemetry: mocks.stopTelemetry,
}));
vi.mock("@/features/cognitive/cognitiveRoutineStorage", () => ({
  clearCognitiveRoutineResults: mocks.clearCognitive,
}));
vi.mock("@/features/family/caregiverObservationStorage", () => ({
  clearCaregiverObservationRecords: mocks.clearCaregiver,
}));
vi.mock("@/features/gamification/weeklyRewards", () => ({
  resetWeeklyRewardState: mocks.resetWeeklyRewards,
}));
vi.mock("@/features/lessons/haruAdminUsageRecordStorage", () => ({
  clearHaruAdminUsageRecords: mocks.clearAdminRecords,
}));
vi.mock("@/features/lessons/haruDemoSessionStorage", () => ({
  clearHaruDemoSessions: mocks.clearDemoSessions,
}));
vi.mock("@/features/lessons/haruRagSync", () => ({
  clearHaruRagOutbox: mocks.clearRagOutbox,
}));
vi.mock("@/features/lessons/haruSttRetry", () => ({
  clearHaruSttRetryOutbox: mocks.clearSttRetry,
}));
vi.mock("@/features/memory/memoryCardStorage", () => ({
  clearMemoryCards: mocks.clearMemory,
}));
vi.mock("@/features/speech/sttJobQueue", () => ({
  clearSttJobQueue: mocks.clearSttQueue,
}));

const participantKeys = [
  "learnerProfile",
  "streakState",
  "gardenState",
  "weeklyRewardState",
  "caregiverObservationRecords",
  "memoryGardenLang",
  "haru:kr:analytics:launched",
] as const;

describe("clearHaruLocalParticipantData", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.clearAdminRecords.mockResolvedValue(undefined);
    mocks.clearSttQueue.mockResolvedValue(true);
    mocks.clearSttRetry.mockReturnValue(true);
    mocks.clearRagOutbox.mockReturnValue(true);
    mocks.clearDemoSessions.mockReturnValue(true);
    mocks.clearCognitive.mockReturnValue(true);
    mocks.clearMemory.mockReturnValue(true);
    mocks.clearCaregiver.mockReturnValue(undefined);
    mocks.clearTelemetry.mockResolvedValue(undefined);
    mocks.stopTelemetry.mockReturnValue(undefined);
    mocks.resetWeeklyRewards.mockReturnValue(undefined);
  });

  it("clears every local participant subsystem while preserving deletion credentials", async () => {
    participantKeys.forEach((key) => localStorage.setItem(key, "participant-data"));
    localStorage.setItem(HARU_CONSENT_STORAGE_KEY, '{"revision":"keep-consent"}');
    localStorage.setItem("haru:kr:enrollment", "keep-kr-enrollment");
    localStorage.setItem("haru:jp:enrollment", "keep-jp-enrollment");
    localStorage.setItem(
      "haru:analytics:kr:installation-id",
      "keep-installation-for-remote-request",
    );
    localStorage.setItem("haruRagDeletionOutbox", "keep-deletion-tombstone");

    const result = await clearHaruLocalParticipantData({ market: "kr" });

    expect(result.complete).toBe(true);
    expect(
      Object.values(result.subsystems).every(
        (subsystem) => subsystem.status === "cleared",
      ),
    ).toBe(true);
    expect(result.preserved).toEqual({ consent: true, enrollment: true });
    participantKeys.forEach((key) => expect(localStorage.getItem(key)).toBeNull());
    expect(localStorage.getItem(HARU_CONSENT_STORAGE_KEY)).toBe(
      '{"revision":"keep-consent"}',
    );
    expect(localStorage.getItem("haru:kr:enrollment")).toBe("keep-kr-enrollment");
    expect(localStorage.getItem("haru:jp:enrollment")).toBe("keep-jp-enrollment");
    expect(localStorage.getItem("haru:analytics:kr:installation-id")).toBe(
      "keep-installation-for-remote-request",
    );
    expect(localStorage.getItem("haruRagDeletionOutbox")).toBe(
      "keep-deletion-tombstone",
    );
    expect(mocks.clearAdminRecords).toHaveBeenCalledTimes(1);
    expect(mocks.clearSttQueue).toHaveBeenCalledTimes(1);
    expect(mocks.clearSttRetry).toHaveBeenCalledTimes(1);
    expect(mocks.clearRagOutbox).toHaveBeenCalledTimes(1);
    expect(mocks.clearDemoSessions).toHaveBeenCalledTimes(1);
    expect(mocks.clearCognitive).toHaveBeenCalledTimes(1);
    expect(mocks.clearMemory).toHaveBeenCalledTimes(1);
    expect(mocks.clearCaregiver).toHaveBeenCalledTimes(1);
    expect(mocks.clearTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.stopTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.resetWeeklyRewards).toHaveBeenCalledTimes(1);
  });

  it("continues independent cleanup and reports every failed subsystem", async () => {
    localStorage.setItem("learnerProfile", "remove-me");
    localStorage.setItem("caregiverObservationRecords", "blocked");
    mocks.clearAdminRecords.mockRejectedValueOnce(new Error("admin blocked"));
    mocks.clearDemoSessions.mockReturnValueOnce(false);
    mocks.clearCaregiver.mockImplementationOnce(() => {
      throw new Error("caregiver blocked");
    });
    mocks.clearTelemetry.mockRejectedValueOnce(new Error("telemetry blocked"));

    const result = await clearHaruLocalParticipantData({ market: "kr" });

    expect(result.complete).toBe(false);
    expect(result.subsystems.adminRecords).toEqual({
      status: "failed",
      reason: "exception",
    });
    expect(result.subsystems.demoSessions).toEqual({
      status: "failed",
      reason: "reported_failure",
    });
    expect(result.subsystems.caregiverObservations).toEqual({
      status: "failed",
      reason: "exception",
    });
    expect(result.subsystems.telemetry).toEqual({
      status: "failed",
      reason: "exception",
    });
    expect(result.subsystems.memoryCards.status).toBe("cleared");
    expect(result.subsystems.profile.status).toBe("cleared");
    expect(localStorage.getItem("learnerProfile")).toBeNull();
    expect(mocks.clearMemory).toHaveBeenCalledTimes(1);
  });
});
