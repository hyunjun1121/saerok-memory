import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../data/mockExercises';
import { ExerciseRenderer } from './ExerciseRenderer';
import '../../i18n';

const baseExercise = {
  id: 'ex_test',
  lessonId: 'lesson_1',
  explanation: 'explanation',
  difficulty: 1,
} satisfies Pick<Exercise, 'id' | 'lessonId' | 'explanation' | 'difficulty'>;

describe('ExerciseRenderer', () => {
  it('renders every declared exercise type without the unsupported fallback', () => {
    const exercises: Exercise[] = [
      {
        ...baseExercise,
        type: 'multiple_choice_meaning',
        prompt: 'Meaning Prompt',
        payload: { options: [{ id: 'a', label: 'A' }] },
        correctAnswer: 'a',
      },
      {
        ...baseExercise,
        type: 'situation_match',
        prompt: 'Situation Prompt',
        payload: { options: [{ id: 'a', label: 'A' }] },
        correctAnswer: 'a',
      },
      {
        ...baseExercise,
        type: 'pair_matching',
        prompt: 'Pair Prompt',
        payload: { pairs: [{ id: 'p1', left: 'Left', right: 'Right' }] },
        correctAnswer: ['p1'],
      },
      {
        ...baseExercise,
        type: 'sequence_order',
        prompt: 'Sequence Prompt',
        payload: { items: [{ id: 'a', label: 'A' }] },
        correctAnswer: ['a'],
      },
      {
        ...baseExercise,
        type: 'audio_choice',
        prompt: 'Audio Prompt',
        payload: { audioText: '듣기', options: [{ id: 'a', label: 'A' }] },
        correctAnswer: 'a',
      },
      {
        ...baseExercise,
        type: 'picture_choice',
        prompt: 'Picture Prompt',
        payload: { options: [{ id: 'a', label: 'A' }] },
        correctAnswer: 'a',
      },
      {
        ...baseExercise,
        type: 'personal_memory_recall',
        prompt: 'Memory Prompt',
        payload: { options: [{ id: 'a', label: 'A' }], memoryField: 'topic' },
        correctAnswer: null,
      },
      {
        ...baseExercise,
        type: 'delayed_word_recall',
        prompt: 'Recall Prompt',
        payload: { phase: 'encode', words: ['a', 'b', 'c'] },
        correctAnswer: null,
      },
      {
        ...baseExercise,
        type: 'attention_pattern',
        prompt: 'Attention Prompt',
        payload: { pattern: [1, 2, 3], options: [{ id: 'a', label: 'A' }] },
        correctAnswer: 'a',
      },
      {
        ...baseExercise,
        type: 'shape_copy_practice',
        prompt: 'Shape Prompt',
        payload: {},
        correctAnswer: null,
      },
      {
        ...baseExercise,
        type: 'speech_repeat_practice',
        prompt: 'Speech Prompt',
        payload: { phrase: 'test phrase' },
        correctAnswer: null,
      },
    ];

    for (const exercise of exercises) {
      const { unmount } = render(
        <ExerciseRenderer
          exercise={exercise}
          globalState="awaiting_answer"
          setGlobalState={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByText(exercise.prompt)).toBeInTheDocument();
      expect(screen.queryByText(/Unsupported exercise type/i)).not.toBeInTheDocument();
      unmount();
    }
  });
});
