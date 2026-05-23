import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockExercises, type Exercise } from '../../data/mockExercises';
import { ExerciseRenderer } from './ExerciseRenderer';
import { getLocalizedText } from '../../utils/localizedText';
import i18n from '../../i18n';

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
        type: 'digit_span_practice',
        prompt: 'Digit Span Prompt',
        payload: { digits: ['4', '8', '2'], direction: 'backward' },
        correctAnswer: ['2', '8', '4'],
      },
      {
        ...baseExercise,
        type: 'verbal_fluency_practice',
        prompt: 'Verbal Fluency Prompt',
        payload: { fluencyCategory: 'animals', durationSeconds: 30 },
        correctAnswer: null,
      },
      {
        ...baseExercise,
        type: 'trail_switching_practice',
        prompt: 'Trail Prompt',
        payload: {
          trailNodes: [
            { id: 'n1', label: '1', group: 'number', x: 20, y: 20 },
            { id: 's1', label: 'Flower', group: 'symbol', x: 70, y: 25 },
          ],
          expectedTrail: ['n1', 's1'],
        },
        correctAnswer: ['n1', 's1'],
      },
      {
        ...baseExercise,
        type: 'stroop_touch_practice',
        prompt: 'Stroop Prompt',
        payload: {
          stroopColorOptions: ['red', 'blue', 'green', 'yellow'],
          stroopTrials: [
            { id: 's1', word: 'blue', inkColor: 'red' },
            { id: 's2', word: 'green', inkColor: 'blue' },
          ],
        },
        correctAnswer: null,
      },
      {
        ...baseExercise,
        type: 'orientation_practice',
        prompt: 'Orientation Prompt',
        payload: { orientationKind: 'date_weekday', targetDateISO: '2026-05-23' },
        correctAnswer: null,
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

      expect(screen.getByText(getLocalizedText(exercise.prompt, 'ko'))).toBeInTheDocument();
      expect(screen.queryByText(/Unsupported exercise type/i)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('renders localized exercise data in Japanese', async () => {
    await i18n.changeLanguage('ja');

    try {
      const exercise = mockExercises.find((item) => item.id === 'ex_2');
      expect(exercise).toBeDefined();

      render(
        <ExerciseRenderer
          exercise={exercise!}
          globalState="awaiting_answer"
          setGlobalState={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByText('「苦あれば楽あり」に近い意味はどれでしょうか。')).toBeInTheDocument();
      expect(screen.getByText('つらい時期のあとに良いことが来る')).toBeInTheDocument();
      expect(screen.queryByText('고진감래와 가장 가까운 뜻은 무엇일까요?')).not.toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('ko');
    }
  });
});
