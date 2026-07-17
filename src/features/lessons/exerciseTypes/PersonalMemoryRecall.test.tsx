import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PersonalMemoryRecall } from '@/features/lessons/exerciseTypes/PersonalMemoryRecall'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@/i18n'
import type { ExerciseState } from '@/features/lessons/exerciseTypes/types'

describe('PersonalMemoryRecall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders prompt and options without text input', () => {
    const mockProps = {
      prompt: "Test Memory Prompt",
      options: [
        { id: "opt_1", label: "Family" },
        { id: "opt_2", label: "Health" }
      ],
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: "awaiting_answer" as ExerciseState
    }

    render(<PersonalMemoryRecall {...mockProps} />)
    expect(screen.getByText("Test Memory Prompt")).toBeInTheDocument()
    expect(screen.getByText("Family")).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('saves a MemoryCard locally when selecting a choice in creation mode', () => {
    const mockProps = {
      prompt: "Test Creation",
      options: [
        { id: "opt_1", label: "Family" },
      ],
      linkedConceptId: "concept_1",
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: "awaiting_answer" as ExerciseState
    }

    const { rerender } = render(<PersonalMemoryRecall {...mockProps} />)

    fireEvent.click(screen.getByText("Family"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("answer_selected")

    rerender(<PersonalMemoryRecall {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("선택하기"))

    expect(mockProps.setGlobalState).toHaveBeenCalledWith("correct_feedback")

    const savedCards = JSON.parse(localStorage.getItem("memoryCards") || "[]")
    expect(savedCards.length).toBe(1)
    expect(savedCards[0].topic).toBe("Family")
    expect(savedCards[0].shareWithFamily).toBe(false)
    expect(savedCards[0].sensitivity).toBe("personal")
  })

  it('saves emotion choices as emotionTag instead of topic', () => {
    const mockProps = {
      prompt: "Emotion Prompt",
      options: [
        { id: "opt_proud", label: "뿌듯함" },
      ],
      linkedConceptId: "concept_1",
      memoryField: "emotionTag" as const,
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: "awaiting_answer" as ExerciseState
    }

    const { rerender } = render(<PersonalMemoryRecall {...mockProps} />)

    fireEvent.click(screen.getByText("뿌듯함"))
    rerender(<PersonalMemoryRecall {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("선택하기"))

    const savedCards = JSON.parse(localStorage.getItem("memoryCards") || "[]")
    expect(savedCards[0].topic).toBeUndefined()
    expect(savedCards[0].emotionTag).toBe("뿌듯함")
  })

  it('records a memory story by voice and saves a card without any typing', async () => {
    const mockProps = {
      prompt: "오늘 있었던 일을 말해주세요",
      options: [],
      linkedConceptId: "daily_memory_1",
      memoryField: "story" as const,
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: "awaiting_answer" as ExerciseState
    }

    render(<PersonalMemoryRecall {...mockProps} />)

    // Voice only — there is no text input anywhere on the story screen.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText("마치기")).toBeInTheDocument()

    fireEvent.click(screen.getByText("마치기"))

    await waitFor(() => {
      expect(mockProps.setGlobalState).toHaveBeenCalledWith("correct_feedback")
    })

    const savedCards = JSON.parse(localStorage.getItem("memoryCards") || "[]")
    expect(savedCards).toHaveLength(1)
    expect(savedCards[0].linkedConceptId).toBe("daily_memory_1")
    expect(savedCards[0].inputMode).toBe("skipped")
    expect(savedCards[0].sensitivity).toBe("sensitive")
    expect(savedCards[0].shareWithFamily).toBe(false)
  })
})

  it('updates an existing MemoryCard locally when correctly answering in review mode', () => {
    // Setup existing card in localStorage
    const mockCard = {
      id: "mem_123",
      userId: "local_user",
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
      source: "daily_lesson",
      topic: "Family",
      sensitivity: "personal",
      shareWithFamily: false,
      reviewState: {
        dueAt: "2026-05-14T00:00:00.000Z",
        intervalDays: 1,
        ease: 2.5,
        reviewCount: 1,
      },
    }
    localStorage.setItem("memoryCards", JSON.stringify([mockCard]))

    const mockProps = {
      prompt: "Test Review",
      options: [
        { id: "opt_1", label: "Family" },
        { id: "opt_2", label: "Health" }
      ],
      memoryId: "mem_123",
      correctOptionId: "opt_1",
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: "awaiting_answer" as ExerciseState
    }

    const { rerender } = render(<PersonalMemoryRecall {...mockProps} />)

    // Select correct option
    fireEvent.click(screen.getByText("Family"))
    expect(mockProps.setGlobalState).toHaveBeenCalledWith("answer_selected")

    rerender(<PersonalMemoryRecall {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("선택하기"))

    expect(mockProps.setGlobalState).toHaveBeenCalledWith("correct_feedback")

    // Check local storage to see if the card was updated (reviewCount should be 2, interval should increase)
    const savedCards = JSON.parse(localStorage.getItem("memoryCards") || "[]")
    expect(savedCards.length).toBe(1)
    expect(savedCards[0].id).toBe("mem_123")
    expect(savedCards[0].reviewState.reviewCount).toBe(2)
    expect(savedCards[0].reviewState.intervalDays).toBe(3) // Progressed to next interval level
    expect(savedCards[0].reviewState.lastResult).toBe("remembered")
  })
