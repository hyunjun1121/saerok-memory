import {
  OFFLINE_PROGRESS_STORAGE_KEY,
  appendOfflineResponse,
  completeOfflineDay,
  loadOfflineProgress,
  removeOfflineResponse,
  restartOfflineDay,
  saveOfflineProgress,
  type OfflineProgress,
} from "@/features/lesson/progressStorage";

describe("offline progress storage", () => {
  beforeEach(() => localStorage.clear());

  it("recovers from missing and malformed storage", () => {
    expect(loadOfflineProgress().activeDay).toBe(1);
    localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, "{");
    expect(loadOfflineProgress()).toMatchObject({ activeDay: 1, completedDays: [] });
  });

  it("stores only minimal answer metadata and replaces a retried exercise", () => {
    const base = loadOfflineProgress();
    const first = appendOfflineResponse(base, {
      exerciseId: "D1_Q1",
      kind: "single_choice",
      selectedIds: ["A"],
      responseMs: 1000,
      completedAt: "2026-08-10T00:00:00.000Z",
    });
    const second = appendOfflineResponse(first, {
      exerciseId: "D1_Q1",
      kind: "single_choice",
      selectedIds: ["B"],
      responseMs: 1200,
      completedAt: "2026-08-10T00:00:01.000Z",
    });
    saveOfflineProgress(second);

    expect(loadOfflineProgress().responses).toEqual([second.responses[0]]);
    expect(JSON.stringify(loadOfflineProgress())).not.toMatch(/audio|transcript|confidence/i);
  });

  it("marks a day complete and advances without passing day seven", () => {
    const afterOne = completeOfflineDay(loadOfflineProgress(), 1);
    expect(afterOne).toMatchObject({ activeDay: 2, completedDays: [1] });
    expect(completeOfflineDay(afterOne, 7).activeDay).toBe(7);
    expect(
      completeOfflineDay({ ...afterOne, activeDay: 7 }, 2).activeDay,
    ).toBe(7);
  });

  it("removes a committed response when the learner chooses retry", () => {
    const response = {
      exerciseId: "D1_Q1",
      kind: "single_choice" as const,
      selectedIds: ["A"],
      responseMs: 1000,
      completedAt: "2026-08-10T00:00:00.000Z",
    };
    const progress = appendOfflineResponse(loadOfflineProgress(), response);

    expect(removeOfflineResponse(progress, "D1_Q1").responses).toEqual([]);
    expect(removeOfflineResponse(progress, "missing")).toBe(progress);
  });

  it("clears only the requested day when a fresh run is requested", () => {
    const progress: OfflineProgress = {
      schemaVersion: 1,
      activeDay: 3,
      completedDays: [1, 2, 3],
      responses: [
        {
          exerciseId: "D1_Q1",
          kind: "single_choice" as const,
          selectedIds: ["A"],
          responseMs: 1_000,
          completedAt: "2026-08-10T00:00:00.000Z",
        },
        {
          exerciseId: "D2_Q1",
          kind: "single_choice" as const,
          selectedIds: ["B"],
          responseMs: 1_100,
          completedAt: "2026-08-10T00:00:01.000Z",
        },
      ],
    };

    expect(restartOfflineDay(progress, 1, ["D1_Q1", "D1_Q2"])).toEqual({
      ...progress,
      activeDay: 1,
      completedDays: [2, 3],
      responses: [progress.responses[1]],
    });
  });
});
