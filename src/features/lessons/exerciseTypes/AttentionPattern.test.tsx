import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttentionPattern } from './AttentionPattern';
import { getCognitiveRoutineResults, clearCognitiveRoutineResults } from '../../cognitive/cognitiveRoutineStorage';
import '../../../i18n';

describe('AttentionPattern', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();
  });

  it('handles correct answer on first try', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    const { rerender } = render(
      <AttentionPattern
        prompt="Find pattern"
        pattern={[10, 8, 6]}
        options={[
          { id: '1', label: '2' },
          { id: '2', label: '4' },
        ]}
        correctOptionId="2"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(setGlobalState).toHaveBeenCalledWith('answer_selected');

    // Simulate parent
    rerender(
      <AttentionPattern
        prompt="Find pattern"
        pattern={[10, 8, 6]}
        options={[
          { id: '1', label: '2' },
          { id: '2', label: '4' },
        ]}
        correctOptionId="2"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="answer_selected"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));

    expect(setGlobalState).toHaveBeenCalledWith('correct_feedback');
    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('attention_pattern');
    expect(results[0].metadata?.missCount).toBe(0);
  });

  it('provides hint feedback on first miss and records on second miss', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    const { rerender } = render(
      <AttentionPattern
        prompt="Find pattern"
        pattern={[10, 8, 6]}
        options={[
          { id: '1', label: '2' },
          { id: '2', label: '4' },
        ]}
        correctOptionId="2"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '2' })); // Incorrect
    rerender(
      <AttentionPattern
        prompt="Find pattern"
        pattern={[10, 8, 6]}
        options={[
          { id: '1', label: '2' },
          { id: '2', label: '4' },
        ]}
        correctOptionId="2"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="answer_selected"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));

    // First miss -> hint
    expect(setGlobalState).toHaveBeenCalledWith('hint_feedback');
    let results = getCognitiveRoutineResults();
    expect(results).toHaveLength(0); // Only records correctly on full miss or correct

    // Second miss -> incorrect
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    rerender(
        <AttentionPattern
          prompt="Find pattern"
          pattern={[10, 8, 6]}
          options={[
            { id: '1', label: '2' },
            { id: '2', label: '4' },
          ]}
          correctOptionId="2"
          onComplete={onComplete}
          setGlobalState={setGlobalState}
          globalState="answer_selected"
        />
    );
    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));

    expect(setGlobalState).toHaveBeenCalledWith('incorrect_feedback');
    results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].metadata?.missCount).toBe(2);
  });
});
