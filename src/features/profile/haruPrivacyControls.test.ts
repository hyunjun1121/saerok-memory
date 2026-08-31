import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAdmin: vi.fn(async () => undefined),
  clearCognitive: vi.fn(() => true),
  clearDemo: vi.fn(() => true),
  clearMemory: vi.fn(() => true),
  clearRetryOutbox: vi.fn(() => true),
  clearSttQueue: vi.fn(async (): Promise<boolean | void> => undefined),
  refreshAdmin: vi.fn(() => true),
  scrubAdminVoice: vi.fn(async () => undefined),
  scrubAdminTranscript: vi.fn(async () => undefined),
  scrubAdminAudio: vi.fn(async () => undefined),
  scrubCognitiveVoice: vi.fn(() => true),
  scrubDemoVoice: vi.fn(() => true),
  scrubMemoryVoice: vi.fn(() => true),
  authorizeReenrollment: vi.fn(() => true),
  clearRagOutbox: vi.fn(() => true),
  enqueueRagDeletion: vi.fn(() => true),
  clearTelemetry: vi.fn(async () => undefined),
}));

vi.mock("@/features/lessons/haruAdminUsageRecordStorage", () => ({
  HARU_ADMIN_USER_ID: "USR-000001",
  clearHaruAdminUsageRecords: mocks.clearAdmin,
  refreshHaruAdminUsageConsent: mocks.refreshAdmin,
  scrubHaruAdminVoiceData: mocks.scrubAdminVoice,
  scrubHaruAdminTranscriptData: mocks.scrubAdminTranscript,
  scrubHaruAdminAudioData: mocks.scrubAdminAudio,
}));
vi.mock("@/features/lessons/haruDemoSessionStorage", () => ({
  clearHaruDemoSessions: mocks.clearDemo,
  scrubHaruDemoVoiceData: mocks.scrubDemoVoice,
}));
vi.mock("@/features/cognitive/cognitiveRoutineStorage", () => ({
  clearCognitiveRoutineResults: mocks.clearCognitive,
  scrubCognitiveVoiceData: mocks.scrubCognitiveVoice,
}));
vi.mock("@/features/memory/memoryCardStorage", () => ({
  clearMemoryCards: mocks.clearMemory,
  scrubMemoryVoiceData: mocks.scrubMemoryVoice,
}));
vi.mock("@/features/lessons/haruSttRetry", () => ({
  clearHaruSttRetryOutbox: mocks.clearRetryOutbox,
}));
vi.mock("@/features/speech/sttJobQueue", () => ({
  clearSttJobQueue: mocks.clearSttQueue,
}));
vi.mock("@/features/lessons/haruRagSync", () => ({
  authorizeHaruRagReenrollment: mocks.authorizeReenrollment,
  clearHaruRagOutbox: mocks.clearRagOutbox,
  enqueueHaruRagUserDeletion: mocks.enqueueRagDeletion,
}));
vi.mock("@/features/analytics/client", () => ({
  clearHaruTelemetry: mocks.clearTelemetry,
}));

import {
  HARU_PRIVACY_CLEANUP_PENDING_KEY,
  applyHaruConsentChange,
  resumeHaruPrivacyCleanup,
} from "@/features/profile/haruPrivacyControls";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";

function pendingCleanupKeys(): string[] {
  return Object.keys(localStorage).filter(
    (key) =>
      key === HARU_PRIVACY_CLEANUP_PENDING_KEY ||
      key.startsWith(`${HARU_PRIVACY_CLEANUP_PENDING_KEY}:`),
  );
}

describe("Haru privacy controls", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    mocks.clearAdmin.mockResolvedValue(undefined);
    mocks.clearCognitive.mockReturnValue(true);
    mocks.clearDemo.mockReturnValue(true);
    mocks.clearMemory.mockReturnValue(true);
    mocks.clearRetryOutbox.mockReturnValue(true);
    mocks.clearSttQueue.mockResolvedValue(undefined);
    mocks.refreshAdmin.mockReturnValue(true);
    mocks.scrubAdminVoice.mockResolvedValue(undefined);
    mocks.scrubAdminTranscript.mockResolvedValue(undefined);
    mocks.scrubAdminAudio.mockResolvedValue(undefined);
    mocks.scrubCognitiveVoice.mockReturnValue(true);
    mocks.scrubDemoVoice.mockReturnValue(true);
    mocks.scrubMemoryVoice.mockReturnValue(true);
    mocks.authorizeReenrollment.mockReturnValue(true);
    mocks.clearRagOutbox.mockReturnValue(true);
    mocks.enqueueRagDeletion.mockReturnValue(true);
    mocks.clearTelemetry.mockResolvedValue(undefined);
  });

  it("persists cleanup intent before scrubbing all retained voice data and queues", async () => {
    mocks.scrubAdminVoice.mockImplementationOnce(async () => {
      expect(pendingCleanupKeys()).not.toHaveLength(0);
    });

    const next = await applyHaruConsentChange({
      transcriptStorage: false,
      audioStorage: false,
    });

    expect(next.transcriptStorage).toBe(false);
    expect(next.audioStorage).toBe(false);
    expect(mocks.scrubAdminVoice).toHaveBeenCalledTimes(1);
    expect(mocks.scrubDemoVoice).toHaveBeenCalledTimes(1);
    expect(mocks.scrubCognitiveVoice).toHaveBeenCalledTimes(1);
    expect(mocks.scrubMemoryVoice).toHaveBeenCalledTimes(1);
    expect(mocks.clearSttQueue).toHaveBeenCalledTimes(1);
    expect(mocks.clearRetryOutbox).toHaveBeenCalledTimes(1);
    expect(pendingCleanupKeys()).toHaveLength(0);
  });

  it("runs full deletion on every call while longitudinal storage remains disabled", async () => {
    await applyHaruConsentChange({ longitudinalUsageStorage: false });
    await applyHaruConsentChange({ longitudinalUsageStorage: false });

    expect(mocks.clearAdmin).toHaveBeenCalledTimes(2);
    expect(mocks.clearDemo).toHaveBeenCalledTimes(2);
    expect(mocks.clearCognitive).toHaveBeenCalledTimes(2);
    expect(mocks.clearMemory).toHaveBeenCalledTimes(2);
  });

  it("aggregates cleanup failures, attempts every operation, and retains the marker", async () => {
    mocks.clearAdmin.mockRejectedValueOnce(new Error("admin blocked"));
    mocks.clearDemo.mockReturnValueOnce(false);
    mocks.clearMemory.mockImplementationOnce(() => {
      throw new Error("memory blocked");
    });

    await expect(
      applyHaruConsentChange({ longitudinalUsageStorage: false }),
    ).rejects.toThrow("haru-privacy-cleanup-failed");

    expect(mocks.clearAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.clearDemo).toHaveBeenCalledTimes(1);
    expect(mocks.clearCognitive).toHaveBeenCalledTimes(1);
    expect(mocks.clearMemory).toHaveBeenCalledTimes(1);
    expect(pendingCleanupKeys()).not.toHaveLength(0);
  });

  it("retains pending cleanup when verified STT queue deletion returns false", async () => {
    mocks.clearSttQueue.mockResolvedValueOnce(false);

    await expect(
      applyHaruConsentChange({ voiceRecording: false }),
    ).rejects.toThrow("haru-privacy-cleanup-failed");

    expect(pendingCleanupKeys()).not.toHaveLength(0);
  });

  it("resumes pending cleanup from current false consent without a transition", async () => {
    mocks.clearAdmin.mockRejectedValueOnce(new Error("temporary failure"));
    await expect(
      applyHaruConsentChange({ longitudinalUsageStorage: false }),
    ).rejects.toThrow("haru-privacy-cleanup-failed");

    await resumeHaruPrivacyCleanup();

    expect(mocks.clearAdmin).toHaveBeenCalledTimes(2);
    expect(mocks.clearDemo).toHaveBeenCalledTimes(2);
    expect(mocks.clearCognitive).toHaveBeenCalledTimes(2);
    expect(mocks.clearMemory).toHaveBeenCalledTimes(2);
    expect(pendingCleanupKeys()).toHaveLength(0);
  });

  it("re-runs cleanup from current false consent even after the prior marker cleared", async () => {
    await applyHaruConsentChange({ longitudinalUsageStorage: false });

    await resumeHaruPrivacyCleanup();

    expect(mocks.clearAdmin).toHaveBeenCalledTimes(2);
    expect(mocks.clearDemo).toHaveBeenCalledTimes(2);
    expect(mocks.clearCognitive).toHaveBeenCalledTimes(2);
    expect(mocks.clearMemory).toHaveBeenCalledTimes(2);
  });

  it("throws and retains the marker when verified marker removal fails", async () => {
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeSpy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: Storage, key: string) {
        if (!key.startsWith(HARU_PRIVACY_CLEANUP_PENDING_KEY)) {
          originalRemoveItem.call(this, key);
        }
      });

    await expect(
      applyHaruConsentChange({ longitudinalUsageStorage: false }),
    ).rejects.toThrow("haru-privacy-cleanup-marker-remove-failed");

    expect(pendingCleanupKeys()).not.toHaveLength(0);
    removeSpy.mockRestore();
  });

  it("does not erase a newer cleanup marker created during an older cleanup", async () => {
    mocks.scrubAdminVoice.mockImplementationOnce(async () => {
      localStorage.setItem(
        HARU_PRIVACY_CLEANUP_PENDING_KEY,
        JSON.stringify({
          longitudinalDeletion: true,
          voiceScrub: false,
          requestedAt: "2026-07-20T01:00:00.000Z",
        }),
      );
    });

    await applyHaruConsentChange({
      transcriptStorage: false,
      audioStorage: false,
    });
    await resumeHaruPrivacyCleanup();

    expect(mocks.clearAdmin).toHaveBeenCalledTimes(1);
    expect(pendingCleanupKeys()).toHaveLength(0);
  });

  it("fails closed and performs full cleanup for a malformed durable marker", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.setItem(HARU_PRIVACY_CLEANUP_PENDING_KEY, "not-json");

    await resumeHaruPrivacyCleanup();

    expect(mocks.clearAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.scrubAdminVoice).toHaveBeenCalledTimes(1);
    expect(pendingCleanupKeys()).toHaveLength(0);
  });

  it("removes queued and remote RAG material when personalization is withdrawn", async () => {
    const next = await applyHaruConsentChange({ personalizedQuestionUse: false });

    expect(next.personalizedQuestionUse).toBe(false);
    expect(mocks.clearRagOutbox).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueRagDeletion).toHaveBeenCalledWith("USR-000001");
    expect(mocks.refreshAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.scrubAdminVoice).not.toHaveBeenCalled();
    expect(mocks.clearAdmin).not.toHaveBeenCalled();
  });

  it("requires explicit RAG re-enrollment when personalization is restored", async () => {
    await applyHaruConsentChange({ personalizedQuestionUse: false });
    mocks.authorizeReenrollment.mockClear();

    const next = await applyHaruConsentChange({ personalizedQuestionUse: true });

    expect(next.personalizedQuestionUse).toBe(true);
    expect(mocks.authorizeReenrollment).toHaveBeenCalledWith("USR-000001");
  });

  it("scrubs retained transcripts without deleting separately consented audio", async () => {
    const next = await applyHaruConsentChange({ transcriptStorage: false });

    expect(next.transcriptStorage).toBe(false);
    expect(mocks.scrubAdminTranscript).toHaveBeenCalledTimes(1);
    expect(mocks.scrubAdminAudio).not.toHaveBeenCalled();
    expect(mocks.scrubAdminVoice).not.toHaveBeenCalled();
  });

  it("scrubs retained audio without deleting separately consented transcripts", async () => {
    const next = await applyHaruConsentChange({ audioStorage: false });

    expect(next.audioStorage).toBe(false);
    expect(mocks.scrubAdminAudio).toHaveBeenCalledTimes(1);
    expect(mocks.scrubAdminTranscript).not.toHaveBeenCalled();
    expect(mocks.scrubAdminVoice).not.toHaveBeenCalled();
  });

  it("clears unsent analytics immediately when analytics consent is withdrawn", async () => {
    const next = await applyHaruConsentChange({ usageAnalytics: false });

    expect(next.usageAnalytics).toBe(false);
    expect(mocks.clearTelemetry).toHaveBeenCalledTimes(1);
  });

  it("reports canonical consent persistence failure", async () => {
    mocks.refreshAdmin.mockReturnValue(false);

    await expect(
      applyHaruConsentChange({ personalizedQuestionUse: false }),
    ).rejects.toThrow("haru-admin-consent-sync-failed");
  });

  it("authorizes RAG re-enrollment only after explicit storage re-consent", async () => {
    await applyHaruConsentChange({ longitudinalUsageStorage: false });

    const next = await applyHaruConsentChange({ longitudinalUsageStorage: true });

    expect(next.longitudinalUsageStorage).toBe(true);
    expect(mocks.authorizeReenrollment).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAdmin).toHaveBeenCalledTimes(1);
  });

  it("keeps storage consent denied and retryable when RAG authorization fails", async () => {
    await applyHaruConsentChange({ longitudinalUsageStorage: false });
    mocks.authorizeReenrollment.mockReturnValueOnce(false);

    await expect(
      applyHaruConsentChange({ longitudinalUsageStorage: true }),
    ).rejects.toThrow("haru-rag-reenrollment-write-failed");

    expect(getHaruConsent().longitudinalUsageStorage).toBe(false);
    expect(mocks.refreshAdmin).not.toHaveBeenCalled();

    const retried = await applyHaruConsentChange({
      longitudinalUsageStorage: true,
    });
    expect(retried.longitudinalUsageStorage).toBe(true);
    expect(mocks.authorizeReenrollment).toHaveBeenCalledTimes(2);
    expect(mocks.refreshAdmin).toHaveBeenCalledTimes(1);
  });

  it("keeps re-consent unpublished until pending deletion succeeds", async () => {
    mocks.clearAdmin.mockRejectedValueOnce(new Error("temporary failure"));
    await expect(
      applyHaruConsentChange({ longitudinalUsageStorage: false }),
    ).rejects.toThrow("haru-privacy-cleanup-failed");

    let releaseCleanup: (() => void) | undefined;
    mocks.clearAdmin.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          releaseCleanup = () => resolve(undefined);
        }),
    );
    const reenroll = applyHaruConsentChange({ longitudinalUsageStorage: true });

    await vi.waitFor(() => expect(mocks.clearAdmin).toHaveBeenCalledTimes(2));
    expect(getHaruConsent().longitudinalUsageStorage).toBe(false);
    expect(mocks.authorizeReenrollment).not.toHaveBeenCalled();

    releaseCleanup?.();
    await reenroll;
    expect(getHaruConsent().longitudinalUsageStorage).toBe(true);
    expect(mocks.authorizeReenrollment).toHaveBeenCalledTimes(1);
  });
});
