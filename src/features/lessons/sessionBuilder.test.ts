import { describe, expect, it, beforeEach } from "vitest";
import { mockExercises } from "../../data/mockExercises";
import type { MemoryCard } from "../memory/types";
import { buildDailySessionExercises } from "./sessionBuilder";

function makeCard(overrides: Partial<MemoryCard> = {}): MemoryCard {
  return {
    id: "mem_test",
    userId: "local_user",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    source: "daily_lesson",
    sensitivity: "personal",
    shareWithFamily: false,
    reviewState: {
      dueAt: "2026-06-01T00:00:00.000Z",
      intervalDays: 1,
      ease: 2.5,
      reviewCount: 0,
    },
    ...overrides,
  };
}

describe("buildDailySessionExercises", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the warm-up exercise first and caps the normal session length", () => {
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      memoryCards: [],
    });

    expect(session.length).toBeLessThanOrEqual(8);
    expect(session[0].id).toBe(mockExercises[0].id);
  });

  it("prioritizes a due memory card by inserting a review exercise", () => {
    const dueCard = makeCard({ id: "mem_due", topic: "family" });
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      memoryCards: [dueCard],
    });

    // A generated review exercise is inserted near the front; the warm-up stays first.
    const reviewInserted = session.some(
      (exercise) => exercise.payload.memoryId === "mem_due",
    );
    expect(reviewInserted).toBe(true);
    expect(session[0].id).toBe(mockExercises[0].id);
  });

  it("returns an uncapped slice from the requested exercise in capture mode", () => {
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      memoryCards: [],
      initialExerciseId: "ex_2",
    });

    expect(session[0].id).toBe("ex_2");
    // Capture path is uncapped: it must reach well beyond the 8-item normal cap.
    expect(session.length).toBeGreaterThan(8);
    expect(session.length).toBeLessThanOrEqual(mockExercises.length);
  });

  it("brings today's-domain exercises to the front on a themed weekday (Mon=attention)", () => {
    // 2026-06-22 is a Monday (getDay()===1 -> attention domain).
    const monday = new Date("2026-06-22T10:00:00");
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      memoryCards: [],
      now: monday,
    });

    // Warm-up stays first.
    expect(session[0].id).toBe(mockExercises[0].id);
    expect(session.length).toBeLessThanOrEqual(8);
    // The first post-warm-up slot is an attention-domain exercise.
    expect(session[1].payload.domain).toBe("attention");
  });

  it("preserves the original order on a review weekday (Sun=review fallback)", () => {
    // 2026-06-21 is a Sunday (getDay()===0 -> review domain, no reorder).
    const sunday = new Date("2026-06-21T10:00:00");
    const session = buildDailySessionExercises({
      exercises: mockExercises,
      memoryCards: [],
      now: sunday,
    });

    expect(session[0].id).toBe(mockExercises[0].id);
    // No reorder => second slot is the raw exercise order.
    expect(session[1].id).toBe(mockExercises[1].id);
  });
});
