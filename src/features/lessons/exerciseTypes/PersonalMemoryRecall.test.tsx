import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PersonalMemoryRecall } from '@/features/lessons/exerciseTypes/PersonalMemoryRecall'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@/i18n'
import type { ExerciseState } from '@/features/lessons/exerciseTypes/types'
import { HARU_DEMO_PERSONA } from '@/data/haru7DayExercises'
import { updateHaruConsent } from '@/features/profile/haruConsentStorage'

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(async () => 'job-memory' as string | null),
  recorder: {
    isSupported: false,
    isRecording: false,
    isFinalizing: false,
    levels: [] as number[],
    durationMs: 0,
    audioAssetUrl: null as string | null,
    sampleRateHz: null as number | null,
    channelCount: null as number | null,
    error: null as string | null,
    start: vi.fn(),
    stop: vi.fn(),
    getDurationMs: vi.fn(() => 0),
    stopAndFinalize: vi.fn(() => Promise.resolve(null)),
    stopAndGetBlob: vi.fn<() => Promise<Blob | null>>(() => Promise.resolve(null)),
  },
}))

vi.mock('@/features/speech/useVoiceRecorder', () => ({
  useVoiceRecorder: () => mocks.recorder,
}))

vi.mock('@/features/speech/sttJobQueue', () => ({
  enqueueSttJob: mocks.enqueue,
}))

function setConsent(
  key: 'voiceRecording' | 'sttProcessing' | 'longitudinalUsageStorage',
  value: boolean,
): void {
  Object.defineProperty(HARU_DEMO_PERSONA.consents, key, {
    configurable: true,
    writable: true,
    value,
  })
}

describe('PersonalMemoryRecall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.enqueue.mockResolvedValue('job-memory')
    mocks.recorder.isSupported = false
    mocks.recorder.isRecording = false
    mocks.recorder.audioAssetUrl = null
    mocks.recorder.getDurationMs.mockReturnValue(0)
    mocks.recorder.stopAndGetBlob.mockResolvedValue(null)
    setConsent('voiceRecording', true)
    setConsent('sttProcessing', true)
    setConsent('longitudinalUsageStorage', true)
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

  it('saves the localized Japanese emotion label instead of a Korean-only value', () => {
    const mockProps = {
      prompt: "Emotion Prompt",
      options: [
        { id: "opt_happy", label: "うれしさ" },
      ],
      linkedConceptId: "concept_1",
      memoryField: "emotionTag" as const,
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: "awaiting_answer" as ExerciseState
    }

    const { rerender } = render(<PersonalMemoryRecall {...mockProps} />)

    fireEvent.click(screen.getByText("うれしさ"))
    rerender(<PersonalMemoryRecall {...mockProps} globalState="answer_selected" />)
    fireEvent.click(screen.getByText("선택하기"))

    const savedCards = JSON.parse(localStorage.getItem("memoryCards") || "[]")
    expect(savedCards[0].topic).toBeUndefined()
    expect(savedCards[0].emotionTag).toBe("うれしさ")
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

  it('switches from reassuring voice guidance to active AI organization guidance', () => {
    mocks.recorder.isSupported = true
    const props = {
      prompt: '오늘 있었던 일을 말해주세요',
      options: [],
      linkedConceptId: 'daily_memory_guidance',
      memoryField: 'story' as const,
      onComplete: vi.fn(),
      setGlobalState: vi.fn(),
      globalState: 'awaiting_answer' as ExerciseState,
    }
    const view = render(<PersonalMemoryRecall {...props} />)

    expect(
      screen.getByText(
        '또박또박 말하려고 애쓰지 않으셔도 돼요. 평소처럼 편하게 말씀해 주세요.',
      ),
    ).toBeInTheDocument()

    mocks.recorder.isRecording = true
    view.rerender(<PersonalMemoryRecall {...props} />)
    expect(screen.getByText('AI가 들은 내용을 글로 정리하고 있어요.')).toBeInTheDocument()
  })

  it('permanently discards a story capture revoked during finalization after quick re-consent', async () => {
    let resolveBlob!: (blob: Blob | null) => void
    mocks.recorder.isSupported = true
    mocks.recorder.isRecording = true
    mocks.recorder.audioAssetUrl = 'blob:revoked-memory'
    mocks.recorder.getDurationMs.mockReturnValue(3_200)
    mocks.recorder.stopAndGetBlob.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBlob = resolve
      }),
    )
    const setGlobalState = vi.fn()

    render(
      <PersonalMemoryRecall
        prompt="오늘 있었던 일을 말해주세요"
        options={[]}
        linkedConceptId="daily_memory_race"
        memoryField="story"
        onComplete={vi.fn()}
        setGlobalState={setGlobalState}
        globalState="awaiting_answer"
      />,
    )

    await waitFor(() => expect(mocks.recorder.start).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('마치기'))
    await waitFor(() => expect(mocks.recorder.stopAndGetBlob).toHaveBeenCalledTimes(1))

    act(() => {
      updateHaruConsent({ sttProcessing: false })
    })
    await waitFor(() => expect(mocks.recorder.stop).toHaveBeenCalledTimes(1))

    mocks.recorder.isRecording = false
    act(() => {
      updateHaruConsent({ sttProcessing: true })
    })
    await waitFor(() => expect(mocks.recorder.start).toHaveBeenCalledTimes(2))

    await act(async () => {
      resolveBlob(new Blob(['revoked-memory'], { type: 'audio/webm' }))
    })

    await waitFor(() => expect(setGlobalState).toHaveBeenCalledWith('correct_feedback'))
    const savedCards = JSON.parse(localStorage.getItem('memoryCards') || '[]')
    expect(savedCards).toHaveLength(1)
    expect(savedCards[0]).toEqual(
      expect.objectContaining({
        inputMode: 'skipped',
        audioAssetUrl: null,
        speechDurationMs: 0,
        sttStatus: 'failed',
      }),
    )
    expect(mocks.enqueue).not.toHaveBeenCalled()
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
