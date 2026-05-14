import { render, screen, fireEvent } from '@testing-library/react'
import { PairMatching } from './PairMatching'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '../../../i18n'

describe('PairMatching', () => {
  const mockProps = {
    prompt: "Test Pairs",
    pairs: [
      { id: "pair_1", left: "Left 1", right: "Right 1" },
      { id: "pair_2", left: "Left 2", right: "Right 2" }
    ],
    onComplete: vi.fn(),
    setGlobalState: vi.fn(),
    globalState: "awaiting_answer" as any
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders prompt and pairs', () => {
    render(<PairMatching {...mockProps} />)
    expect(screen.getByText("Test Pairs")).toBeInTheDocument()
    expect(screen.getByText("Left 1")).toBeInTheDocument()
    expect(screen.getByText("Right 1")).toBeInTheDocument()
  })

  it('matches pairs correctly and triggers correct feedback', () => {
    const { rerender } = render(<PairMatching {...mockProps} />)
    fireEvent.click(screen.getByText("Left 1"))
    fireEvent.click(screen.getByText("Right 1"))
    fireEvent.click(screen.getByText("Left 2"))
    fireEvent.click(screen.getByText("Right 2"))

    expect(mockProps.setGlobalState).toHaveBeenCalledWith("answer_selected")

    rerender(<PairMatching {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("확인하기"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("correct_feedback")
  })
})
