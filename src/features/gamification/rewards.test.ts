import { calculateExerciseReward, calculateSessionCompletionReward } from './rewards';
import { describe, it, expect } from 'vitest';

describe('rewards', () => {
  it('awards correct points based on action', () => {
    expect(calculateExerciseReward('correct_first_try')).toBe(3);
    expect(calculateExerciseReward('hint_used')).toBe(1);
    expect(calculateExerciseReward('completed')).toBe(2);
    expect(calculateExerciseReward('memory_review')).toBe(5);
  });

  it('awards 10 points for session completion', () => {
    expect(calculateSessionCompletionReward()).toBe(10);
  });
});
