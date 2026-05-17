import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ShapeCopyPractice } from './ShapeCopyPractice';
import { getCognitiveRoutineResults, clearCognitiveRoutineResults } from '../../cognitive/cognitiveRoutineStorage';
import '../../../i18n';

describe('ShapeCopyPractice', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCognitiveRoutineResults();

    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    }) as unknown as HTMLCanvasElement['getContext'];

    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
  });

  it('renders and completes without throwing', () => {
    const onComplete = vi.fn();
    const setGlobalState = vi.fn();

    render(
      <ShapeCopyPractice
        prompt="Draw"
        onComplete={onComplete}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />
    );

    // Should enable the "Done" button immediately or after drawing
    expect(setGlobalState).toHaveBeenCalledWith('answer_selected');

    // Simulate drawing
    const canvas = screen.getByLabelText('Drawing area');
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(canvas);

    fireEvent.click(screen.getByRole('button', { name: '다 그렸습니다' }));

    expect(setGlobalState).toHaveBeenCalledWith('correct_feedback');
    expect(onComplete).toHaveBeenCalled();

    const results = getCognitiveRoutineResults();
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('shape_copy_practice');
    expect(results[0].metadata?.hasDrawn).toBe(true);
  });
});
