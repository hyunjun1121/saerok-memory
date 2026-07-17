import { calculateNextReviewState, calculatePriority } from '@/features/memory/memoryScheduler';
import type { MemoryCard, ReviewState } from '@/features/memory/types';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('memoryScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateNextReviewState', () => {
    it('creates initial state for new card', () => {
      const state = calculateNextReviewState(undefined, 'remembered');
      expect(state.intervalDays).toBe(1);
      expect(state.reviewCount).toBe(1);
      expect(state.dueAt).toBe('2026-05-14T10:00:00.000Z');
    });

    it('progresses to 3 days on first review success', () => {
      const currentState: ReviewState = {
        dueAt: '2026-05-13T10:00:00.000Z',
        intervalDays: 1,
        ease: 2.5,
        reviewCount: 1,
      };
      const state = calculateNextReviewState(currentState, 'remembered');
      expect(state.intervalDays).toBe(3);
      expect(state.dueAt).toBe('2026-05-16T10:00:00.000Z');
    });

    it('drops interval on miss', () => {
      const currentState: ReviewState = {
        dueAt: '2026-05-13T10:00:00.000Z',
        intervalDays: 7,
        ease: 2.5,
        reviewCount: 3,
      };
      const state = calculateNextReviewState(currentState, 'missed');
      expect(state.intervalDays).toBe(4);
      expect(state.ease).toBe(2.3);
      expect(state.lastResult).toBe('missed');
    });

    it('drops interval on hint_used', () => {
      const currentState: ReviewState = {
        dueAt: '2026-05-13T10:00:00.000Z',
        intervalDays: 7,
        ease: 2.5,
        reviewCount: 3,
      };
      const state = calculateNextReviewState(currentState, 'hint_used');
      expect(state.intervalDays).toBe(4);
      expect(state.ease).toBe(2.3);
      expect(state.lastResult).toBe('hint_used');
    });
  });

  describe('calculatePriority', () => {
    it('prioritizes overdue cards', () => {
      const card: MemoryCard = {
        id: '1', userId: 'user1', createdAt: '', updatedAt: '',
        source: 'daily_lesson', sensitivity: 'personal', shareWithFamily: false,
        topic: 'health',
        reviewState: {
          dueAt: '2026-05-10T10:00:00.000Z',
          intervalDays: 1, ease: 2.5, reviewCount: 1, lastResult: 'remembered'
        }
      };
      expect(calculatePriority(card)).toBe(11);
    });

    it('prioritizes family/emotion cards', () => {
      const card: MemoryCard = {
        id: '1', userId: 'user1', createdAt: '', updatedAt: '',
        source: 'daily_lesson', sensitivity: 'personal', shareWithFamily: false,
        topic: 'family',
        reviewState: {
          dueAt: '2026-05-14T10:00:00.000Z',
          intervalDays: 1, ease: 2.5, reviewCount: 1, lastResult: 'remembered'
        }
      };
      expect(calculatePriority(card)).toBe(1);
    });

    it('penalizes recent misses heavily to ensure review', () => {
        const card: MemoryCard = {
          id: '1', userId: 'user1', createdAt: '', updatedAt: '',
          source: 'daily_lesson', sensitivity: 'personal', shareWithFamily: false,
          topic: 'health',
          reviewState: {
            dueAt: '2026-05-13T09:00:00.000Z',
            intervalDays: 1, ease: 2.5, reviewCount: 1, lastResult: 'missed'
          }
        };
        const p = calculatePriority(card);
        expect(p).toBeGreaterThan(15);
      });
  });
});
