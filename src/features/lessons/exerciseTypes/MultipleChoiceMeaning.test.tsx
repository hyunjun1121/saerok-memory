import { render, screen, fireEvent } from '@testing-library/react'
import { MultipleChoiceMeaning } from './MultipleChoiceMeaning'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../../../i18n'
import type { ExerciseState } from './types'

describe('MultipleChoiceMeaning', () => {
  const mockProps = {
    prompt: "Test Prompt",
    options: [
      { id: "opt_1", label: "Correct Option" },
      { id: "opt_2", label: "Wrong Option" }
    ],
    correctOptionId: "opt_1",
    explanation: "This is why",
    onComplete: vi.fn(),
    setGlobalState: vi.fn(),
    globalState: "awaiting_answer" as ExerciseState
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders prompt and options', () => {
    render(<MultipleChoiceMeaning {...mockProps} />)
    expect(screen.getByText("Test Prompt")).toBeInTheDocument()
    expect(screen.getByText("Correct Option")).toBeInTheDocument()
    expect(screen.getByText("Wrong Option")).toBeInTheDocument()
  })

  it('selects option and triggers check', () => {
    const { rerender } = render(<MultipleChoiceMeaning {...mockProps} />)
    fireEvent.click(screen.getByText("Correct Option"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("answer_selected")

    rerender(<MultipleChoiceMeaning {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("확인하기"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("correct_feedback")
  })
})
