import { render, screen, fireEvent } from '@testing-library/react'
import { SituationMatch } from './SituationMatch'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../../../i18n'
import type { ExerciseState } from './types'

describe('SituationMatch', () => {
  const mockProps = {
    prompt: "Test Situation",
    options: [
      { id: "opt_1", label: "Correct Situation" },
      { id: "opt_2", label: "Wrong Situation" }
    ],
    correctOptionId: "opt_1",
    onComplete: vi.fn(),
    setGlobalState: vi.fn(),
    globalState: "awaiting_answer" as ExerciseState
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders prompt and options', () => {
    render(<SituationMatch {...mockProps} />)
    expect(screen.getByText("Test Situation")).toBeInTheDocument()
    expect(screen.getByText("Correct Situation")).toBeInTheDocument()
  })

  it('selects option and triggers check', () => {
    const { rerender } = render(<SituationMatch {...mockProps} />)
    fireEvent.click(screen.getByText("Correct Situation"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("answer_selected")

    rerender(<SituationMatch {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("확인하기"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("correct_feedback")
  })
})
