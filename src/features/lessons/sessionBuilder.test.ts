import { describe, expect, it } from "vitest";
import {
  HARU_WEEK_PLAN,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import { mockExercises } from "@/data/mockExercises";
import {
  DEMO_ROUTINE_IDS,
  buildDailySessionExercises,
  getHaruDemoDay,
  parseHaruWeekDay,
} from "@/features/lessons/sessionBuilder";

describe("buildDailySessionExercises", () => {
  it("returns each authored six-question day in order", () => {
    for (const plan of HARU_WEEK_PLAN) {
      const session = buildDailySessionExercises({
        exercises: mockExercises,
        dayOverride: plan.day,
      });

      expect(session.map((exercise) => exercise.id)).toEqual([...plan.exerciseIds]);
    }
  });

  it("selects the authored day only during its Korea demo date", () => {
    const mondayInKorea = new Date("2026-07-19T15:30:00.000Z");
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      now: mondayInKorea,
    });

    expect(getHaruDemoDay(mondayInKorea)).toBe(1);
    expect(session.map((exercise) => exercise.id)).toEqual([
      ...HARU_WEEK_PLAN[0].exerciseIds,
    ]);
  });

  it("selects Japanese authored dates in Tokyo without exposing the Korean week", () => {
    const mondayInTokyo = new Date("2026-07-26T15:30:00.000Z");
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      market: "jp",
      now: mondayInTokyo,
    });

    expect(getHaruDemoDay(mondayInTokyo, "jp")).toBe(1);
    expect(session.map((exercise) => exercise.id)).toEqual([
      ...HARU_WEEK_PLAN[0].exerciseIds,
    ]);
  });

  it("keeps the regular routine outside the fixed-date persona demo", () => {
    const beforeDemo = new Date("2026-07-17T03:00:00.000Z");
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      now: beforeDemo,
    });

    expect(getHaruDemoDay(beforeDemo)).toBeUndefined();
    expect(session.map((exercise) => exercise.id)).toEqual(DEMO_ROUTINE_IDS);
  });

  it("starts uncapped at the requested exercise in capture/deeplink mode", () => {
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      initialExerciseId: "ex_2",
      dayOverride: 7,
    });

    const expectedIndex = mockExercises.findIndex((exercise) => exercise.id === "ex_2");
    expect(session[0].id).toBe("ex_2");
    expect(session.length).toBe(mockExercises.length - expectedIndex);
  });

  it("falls back to the selected day when the requested id is unknown", () => {
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      initialExerciseId: "does_not_exist",
      dayOverride: 4,
    });

    expect(session.map((exercise) => exercise.id)).toEqual([
      ...HARU_WEEK_PLAN[3].exerciseIds,
    ]);
  });
});

describe("parseHaruWeekDay", () => {
  it.each([1, 2, 3, 4, 5, 6, 7] as HaruWeekDay[])(
    "accepts day %i",
    (day) => {
      expect(parseHaruWeekDay(String(day))).toBe(day);
    },
  );

  it.each([null, undefined, "", "0", "8", "1.5", "monday"])(
    "rejects invalid value %s",
    (value) => {
      expect(parseHaruWeekDay(value)).toBeUndefined();
    },
  );
});
