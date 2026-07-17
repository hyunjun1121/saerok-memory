import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueRag: vi.fn(),
  getRecord: vi.fn(),
  patchStt: vi.fn(),
  reconcileStt: vi.fn(),
  resumePrivacy: vi.fn(async (): Promise<void> => undefined),
  startRag: vi.fn(),
  startStt: vi.fn(),
  startGenericStt: vi.fn(),
  stopRag: vi.fn(),
  stopStt: vi.fn(),
  stopGenericStt: vi.fn(),
}));

vi.mock("@/features/lessons/haruAdminUsageRecordStorage", () => ({
  getHaruAdminUsageRecord: mocks.getRecord,
  patchHaruAdminVoiceSttSuccess: mocks.patchStt,
}));

vi.mock("@/features/lessons/haruRagSync", () => ({
  enqueueHaruRagRecord: mocks.enqueueRag,
  startHaruRagSync: mocks.startRag,
}));

vi.mock("@/features/lessons/haruSttRetry", () => ({
  reconcileHaruSttRetryOutbox: mocks.reconcileStt,
  startHaruSttRetry: mocks.startStt,
}));
vi.mock("@/features/speech/sttJobQueue", () => ({
  startSttJobQueue: mocks.startGenericStt,
}));
vi.mock("@/features/profile/haruPrivacyControls", () => ({
  resumeHaruPrivacyCleanup: mocks.resumePrivacy,
}));

import { startHaruBackgroundSync } from "@/features/lessons/haruBackgroundSync";

describe("Haru background sync bootstrap", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.startRag.mockReturnValue(mocks.stopRag);
    mocks.startStt.mockReturnValue(mocks.stopStt);
    mocks.startGenericStt.mockReturnValue(mocks.stopGenericStt);
    mocks.resumePrivacy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resumes privacy cleanup before reconciling and disposing background workers", async () => {
    const record = { dataset: { dataset_id: "test" } };
    mocks.getRecord.mockReturnValue(record);

    const stop = startHaruBackgroundSync();

    await vi.waitFor(() => expect(mocks.startRag).toHaveBeenCalledTimes(1));
    expect(mocks.resumePrivacy).toHaveBeenCalledTimes(1);
    expect(mocks.startRag).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueRag).toHaveBeenCalledWith(record);
    expect(mocks.reconcileStt).toHaveBeenCalledWith(record);
    expect(mocks.startStt).toHaveBeenCalledWith(mocks.patchStt);
    expect(mocks.startGenericStt).toHaveBeenCalledTimes(1);

    stop();
    expect(mocks.stopStt).toHaveBeenCalledTimes(1);
    expect(mocks.stopRag).toHaveBeenCalledTimes(1);
    expect(mocks.stopGenericStt).toHaveBeenCalledTimes(1);
  });

  it("starts workers without fabricating a record when local state is empty", async () => {
    mocks.getRecord.mockReturnValue(null);

    startHaruBackgroundSync();

    await vi.waitFor(() => expect(mocks.startRag).toHaveBeenCalledTimes(1));
    expect(mocks.enqueueRag).not.toHaveBeenCalled();
    expect(mocks.reconcileStt).not.toHaveBeenCalled();
    expect(mocks.startStt).toHaveBeenCalledTimes(1);
  });

  it("does not start workers before pending privacy cleanup settles", async () => {
    let finishCleanup: (() => void) | undefined;
    mocks.resumePrivacy.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
    );

    startHaruBackgroundSync();
    expect(mocks.startRag).not.toHaveBeenCalled();

    finishCleanup?.();
    await vi.waitFor(() => expect(mocks.startRag).toHaveBeenCalledTimes(1));
  });

  it("keeps workers blocked after cleanup failure and retries before starting", async () => {
    vi.useFakeTimers();
    mocks.resumePrivacy
      .mockRejectedValueOnce(new Error("cleanup blocked"))
      .mockResolvedValueOnce(undefined);

    startHaruBackgroundSync();
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.startRag).not.toHaveBeenCalled();
    expect(mocks.startStt).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(mocks.resumePrivacy).toHaveBeenCalledTimes(2);
    expect(mocks.startRag).toHaveBeenCalledTimes(1);
    expect(mocks.startStt).toHaveBeenCalledTimes(1);
  });

  it("cancels cleanup retries when bootstrap is stopped", async () => {
    vi.useFakeTimers();
    mocks.resumePrivacy.mockRejectedValue(new Error("cleanup blocked"));

    const stop = startHaruBackgroundSync();
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mocks.resumePrivacy).toHaveBeenCalledTimes(1);
    expect(mocks.startRag).not.toHaveBeenCalled();
  });
});
