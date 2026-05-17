import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpeechRepeatPractice } from './SpeechRepeatPractice';
import { getCognitiveRoutineResults, clearCognitiveRoutineResults } from '../../cognitive/cognitiveRoutineStorage';
import '../../../i18n';

describe('SpeechRepeatPractice', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();

    // Mock speech APIs as unavailable for this test
    Object.defineProperty(window, 'speechSynthesis', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      writable: true,
    });
  });

  it('renders and completes even when speech APIs are unavailable', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
      <SpeechRepeatPractice
        prompt="Speak"
        phrase="Test phrase"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    // Set immediately to answer_selected so it can be bypassed
    expect(setGlobalState).toHaveBeenCalledWith('answer_selected');

    fireEvent.click(screen.getByRole('button', { name: '다 말했습니다' }));

    expect(setGlobalState).toHaveBeenCalledWith('correct_feedback');
    expect(onComplete).toHaveBeenCalled();

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('speech_repeat_practice');
  });
});
