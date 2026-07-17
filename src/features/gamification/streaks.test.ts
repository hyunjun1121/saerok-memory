import { updateStreak, type StreakState } from '@/features/gamification/streaks';
import { describe, it, expect } from 'vitest';

describe('streaks', () => {
  it('starts a new streak for the first time', () => {
    const initialState: StreakState = { currentStreak: 0, lastSessionDate: null, longestStreak: 0 };
    const state = updateStreak(initialState, new Date('2026-05-13'));

    expect(state.currentStreak).toBe(1);
    expect(state.lastSessionDate).toBe('2026-05-13');
    expect(state.longestStreak).toBe(1);
  });

  it('maintains streak on consecutive days', () => {
    const initialState: StreakState = { currentStreak: 1, lastSessionDate: '2026-05-13', longestStreak: 1 };
    const state = updateStreak(initialState, new Date('2026-05-14'));

    expect(state.currentStreak).toBe(2);
    expect(state.lastSessionDate).toBe('2026-05-14');
    expect(state.longestStreak).toBe(2);
  });

  it('resets streak if a day is missed', () => {
    const initialState: StreakState = { currentStreak: 5, lastSessionDate: '2026-05-10', longestStreak: 5 };
    const state = updateStreak(initialState, new Date('2026-05-13'));

    expect(state.currentStreak).toBe(1);
    expect(state.lastSessionDate).toBe('2026-05-13');
    expect(state.longestStreak).toBe(5);
  });

  it('does not increment if played multiple times on the same day', () => {
    const initialState: StreakState = { currentStreak: 3, lastSessionDate: '2026-05-13', longestStreak: 3 };
    const state = updateStreak(initialState, new Date('2026-05-13'));

    expect(state.currentStreak).toBe(3);
  });
});
