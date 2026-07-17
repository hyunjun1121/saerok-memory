import { generateMemoryReviewExercise } from '@/features/memory/memoryReviewGenerator';
import type { MemoryCard } from '@/features/memory/types';
import { afterEach, describe, it, expect } from 'vitest';
import i18n from '@/i18n';

describe('memoryReviewGenerator', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

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

    expect(exercise?.prompt).toBeTruthy(); // Using i18next t() so prompt might just be the string or key depending on environment
    const options = exercise?.payload.options ?? [];
    const correctOption = options.find((o) => o.id === 'correct');
    expect(correctOption).toBeDefined();
    expect(correctOption?.label).toBe('뿌듯함');
  });

  it('treats legacy emotion values stored in topic as emotions', () => {
    const card = { ...baseCard, topic: '뿌듯함' as unknown as MemoryCard['topic'] };
    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise?.payload.memoryField).toBe('emotionTag');
    expect(exercise?.prompt).toBeTruthy();
  });

  it('localizes a topic review exercise in Japanese', async () => {
    await i18n.changeLanguage('ja');

    const card = { ...baseCard, topic: 'family' as const };
    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise?.prompt).toBe('前回、どの話題の思い出を選びましたか？');
    const correctOption = exercise?.payload.options?.find((o) => o.id === 'correct');
    expect(correctOption?.label).toBe('家族');
  });

  it('generates a review question from a saved spoken story cue', () => {
    const card: MemoryCard = {
      ...baseCard,
      originalTranscript: '지난봄에 딸과 병원에 다녀온 뒤 국밥집에서 밥을 먹었어요. 딸이 우산을 챙겨줘 고마웠어요.',
      textSummary: '지난봄에 딸과 병원에 다녀온 뒤 국밥집에서 밥을 먹었어요.',
      storyCues: {
        people: ['딸'],
        places: ['병원', '국밥집'],
        objects: ['우산'],
        emotions: ['고마움'],
        timeHints: ['봄'],
      },
    };

    const exercise = generateMemoryReviewExercise(card, 'lesson_1');

    expect(exercise?.type).toBe('personal_memory_recall');
    expect(exercise?.payload.memoryField).toBe('story');
    expect(exercise?.correctAnswer).toBe('correct');
    expect(exercise?.explanation).toContain('지난봄에 딸과 병원');
    const correctOption = exercise?.payload.options?.find((o) => o.id === 'correct');
    expect(correctOption?.label).toBe('딸');
  });

  it('localizes known Korean story cues into Japanese review choices', async () => {
    await i18n.changeLanguage('ja');

    const card: MemoryCard = {
      ...baseCard,
      originalTranscript: '지난봄에 딸과 병원에 다녀온 뒤 국밥집에서 밥을 먹었어요.',
      textSummary: '지난봄에 딸과 병원에 다녀온 뒤 국밥집에서 밥을 먹었어요.',
      storyCues: {
        people: ['딸'],
        places: ['병원', '국밥집'],
        objects: ['우산'],
        emotions: ['고마움'],
        timeHints: ['봄'],
      },
    };

    const exercise = generateMemoryReviewExercise(card, 'lesson_1');
    const correctOption = exercise?.payload.options?.find((o) => o.id === 'correct');

    expect(exercise?.prompt).toBe('前回話した思い出で、一緒にいた人は誰でしたか？');
    expect(correctOption?.label).toBe('娘');
  });

  it('returns null if no usable data exists', () => {
    const exercise = generateMemoryReviewExercise(baseCard, 'lesson_1');
    expect(exercise).toBeNull();
  });
});
