import { generateMemoryReviewExercise } from './memoryReviewGenerator';
import type { MemoryCard } from './types';
import { describe, it, expect } from 'vitest';

describe('memoryReviewGenerator', () => {
  const baseCard: MemoryCard = {
    id: 'test_card_1',
    userId: 'user_1',
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
    source: 'daily_lesson',
    sensitivity: 'personal',
    shareWithFamily: false,
    reviewState: {
      dueAt: '2026-05-14T00:00:00.000Z',
      intervalDays: 1,
      ease: 2.5,
      reviewCount: 1,
    },
  };

  it('generates Level 1 exercise (2 choices) for topic', () => {
    const card = { ...baseCard, topic: 'family' as const };
    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise).toBeDefined();
    expect(exercise?.type).toBe('personal_memory_recall');
    expect(exercise?.difficulty).toBe(2);
    const options = exercise?.payload.options ?? [];
    expect(options.length).toBe(2);

    const correctOption = options.find((o) => o.id === 'correct');
    expect(correctOption).toBeDefined();
    expect(correctOption?.label).toBe('가족');
  });

  it('generates Level 2 exercise (3 choices) when reviewCount > 1', () => {
    const card = {
      ...baseCard,
      topic: 'health' as const,
      reviewState: { ...baseCard.reviewState, reviewCount: 2 }
    };
    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise?.difficulty).toBe(3);
    expect(exercise?.payload.options?.length).toBe(3);
  });

  it('falls back to emotionTag if topic is missing/unknown', () => {
    const card = { ...baseCard, emotionTag: '뿌듯함' };
    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise?.prompt).toContain('어떤 기분');
    const options = exercise?.payload.options ?? [];
    const correctOption = options.find((o) => o.id === 'correct');
    expect(correctOption).toBeDefined();
    expect(correctOption?.label).toBe('뿌듯함');
  });

  it('treats legacy emotion values stored in topic as emotions', () => {
    const card = { ...baseCard, topic: '뿌듯함' as unknown as MemoryCard['topic'] };
    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise?.payload.memoryField).toBe('emotionTag');
    expect(exercise?.prompt).toContain('어떤 기분');
  });

  it('returns null if no usable data exists', () => {
    const exercise = generateMemoryReviewExercise(baseCard, 'lesson_1');
    expect(exercise).toBeNull();
  });
});
