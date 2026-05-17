import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DelayedWordRecall } from './DelayedWordRecall';
import { getCognitiveRoutineResults, clearCognitiveRoutineResults } from '../../cognitive/cognitiveRoutineStorage';
import '../../../i18n';

describe('DelayedWordRecall', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();
  });

  it('encode phase completes without selection and stores metadata', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
      <DelayedWordRecall
        prompt="Remember these"
        phase="encode"
        words={['A', 'B', 'C']}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '네, 기억했습니다' }));

    expect(setGlobalState).toHaveBeenCalledWith('correct_feedback');
    expect(onComplete).toHaveBeenCalled();

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('delayed_word_recall');
    expect(results[0].metadata?.phase).toBe('encode');
  });

  it('recall phase requires expected selection count to check', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    const { rerender } = render(
      <DelayedWordRecall
        prompt="Recall these"
        phase="recall"
        options={[
          { id: '1', label: 'A' },
          { id: '2', label: 'B' },
          { id: '3', label: 'C' },
          { id: '4', label: 'D' },
        ]}
        requiredSelectionCount={3}
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    // Initial state: waiting for answers, Check button should not be enabled fully
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(setGlobalState).toHaveBeenCalledWith('awaiting_answer');

    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(setGlobalState).toHaveBeenCalledWith('awaiting_answer');

    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(setGlobalState).toHaveBeenCalledWith('answer_selected');

    // Simulate parent updating global state
    rerender(
        <DelayedWordRecall
          prompt="Recall these"
          phase="recall"
          options={[
            { id: '1', label: 'A' },
            { id: '2', label: 'B' },
            { id: '3', label: 'C' },
            { id: '4', label: 'D' },
          ]}
          requiredSelectionCount={3}
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState="answer_selected"
        />
    );

    // Check should be possible now
    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('delayed_word_recall');
    expect(results[0].metadata?.phase).toBe('recall');
    expect(results[0].metadata?.selectedAnswers).toEqual(expect.arrayContaining(['1', '2', '3']));
  });
});
