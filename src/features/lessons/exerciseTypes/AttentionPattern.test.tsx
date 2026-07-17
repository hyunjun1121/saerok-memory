import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AttentionPattern } from '@/features/lessons/exerciseTypes/AttentionPattern';
import { getCognitiveRoutineResults, clearCognitiveRoutineResults } from '@/features/cognitive/cognitiveRoutineStorage';
import '@/i18n';

describe('AttentionPattern', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();
  });

  it('shows the correct result immediately on first try', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
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

    // Immediate result — no separate confirm step.
    expect(setGlobalState).toHaveBeenCalledWith('correct_feedback');
    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('attention_pattern');
    expect(results[0].metadata?.missCount).toBe(0);
  });

  it('gives hint feedback on first miss and records on second miss', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    const props = (globalState: "awaiting_answer") => (
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
        globalState={globalState}
      />
    );

    const { rerender } = render(props("awaiting_answer"));

    fireEvent.click(screen.getByRole('button', { name: '2' })); // Incorrect

    // First miss -> hint, nothing recorded yet.
    expect(setGlobalState).toHaveBeenCalledWith('hint_feedback');
    expect(getCognitiveRoutineResults()).toHaveLength(0);

    // Parent resets to awaiting_answer after the hint; second miss -> incorrect.
    rerender(props("awaiting_answer"));
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    expect(setGlobalState).toHaveBeenCalledWith('incorrect_feedback');
    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].metadata?.missCount).toBe(2);
  });
});
