import { beforeEach, describe, expect, it } from "vitest";
import type { RoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import {
  getCompletedDaysThisWeek,
  getWeeklyRewardState,
  recordWeeklyCompletion,
  resetWeeklyRewardState,
} from "@/features/gamification/weeklyRewards";

const NOW = new Date("2026-06-23T12:00:00.000Z");

function routine(day: string, completed = true): RoutineResult {
  return {
    id: `r_${day}`,
    type: "attention_pattern",
    timestamp: `${day}T09:00:00.000Z`,
    completed,
  };
}

describe("weeklyRewards", () => {
  beforeEach(() => {
    localStorage.clear();
    resetWeeklyRewardState();
  });

  it("counts distinct completed days in the last 7 days (score-free)", () => {
    const results = [
      routine("2026-06-23"),
      routine("2026-06-23"), // same day, deduped
      routine("2026-06-22"),
      routine("2026-06-20", false), // not completed, ignored
      routine("2026-06-10"), // outside 7-day window, ignored
    ];

    const days = getCompletedDaysThisWeek(results, NOW);
    expect(days).toEqual(expect.arrayContaining(["2026-06-23", "2026-06-22"]));
    expect(days).toHaveLength(2);
  });

  it("records today completion idempotently", () => {
    const first = recordWeeklyCompletion(NOW);
    const second = recordWeeklyCompletion(NOW);

    expect(first.completedDays).toEqual(["2026-06-23"]);
    expect(second.completedDays).toEqual(["2026-06-23"]);
    expect(getWeeklyRewardState(NOW).completedDays).toHaveLength(1);
  });
});
