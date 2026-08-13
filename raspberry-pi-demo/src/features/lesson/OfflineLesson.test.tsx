import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FourButtonProvider } from "@/features/input";
import { audioManager } from "@/features/audio";
import { OFFLINE_PROGRESS_STORAGE_KEY } from "@/features/lesson/progressStorage";
import { OfflineLessonScreen } from "@/features/lesson/OfflineLesson";
import { getOfflineQuestionsForDay } from "@/features/lesson/questionModel";

vi.mock("@/features/audio", () => ({
  audioManager: {
    playNarration: vi.fn().mockResolvedValue({ status: "played" }),
    playUi: vi.fn().mockResolvedValue({ status: "played" }),
    stopNarration: vi.fn(),
  },
}));

let now = 1_000;
let restoreMonotonicNow: () => void = () => undefined;

function press(code: "Digit1" | "Digit2" | "Digit3" | "Digit4") {
  if (vi.isFakeTimers()) {
    act(() => vi.advanceTimersByTime(300));
  } else {
    now += 300;
  }
  const key = code.at(-1) ?? "";
  fireEvent.keyDown(window, { code, key });
  fireEvent.keyUp(window, { code, key });
}

function DayTwoNavigation() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/lesson?day=2")}>
      open day two
    </button>
  );
}

function renderLesson(includeDayNavigation = false, initialEntry = "/lesson?day=1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FourButtonProvider>
        {includeDayNavigation ? <DayTwoNavigation /> : null}
        <Routes>
          <Route path="/lesson" element={<OfflineLessonScreen />} />
          <Route path="/result" element={<div data-testid="result-route">result</div>} />
        </Routes>
      </FourButtonProvider>
    </MemoryRouter>,
  );
}

function seedAnsweredDayOneQuestions(count: number) {
  const responses = getOfflineQuestionsForDay(1).slice(0, count).map((question, index) => ({
    exerciseId: question.exercise.id,
    kind: question.responseType,
    selectedIds: [],
    responseMs: 1_000 + index,
    completedAt: `2026-08-10T00:00:0${index}.000Z`,
  }));
  localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    activeDay: 1,
    completedDays: [],
    responses,
  }));
}

describe("OfflineLessonScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    now = 1_000;
    const performanceNowSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    restoreMonotonicNow = () => performanceNowSpy.mockRestore();
    vi.clearAllMocks();
    vi.mocked(audioManager.playNarration).mockResolvedValue({ status: "played" });
    vi.mocked(audioManager.playUi).mockResolvedValue({ status: "played" });
    vi.mocked(audioManager.stopNarration).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    restoreMonotonicNow();
  });

  it("requires a second press on the same physical button before saving a choice", async () => {
    renderLesson();

    press("Digit2");
    expect(await screen.findByTestId("question-D1_Q1")).toBeInTheDocument();

    press("Digit2");
    expect(screen.getByTestId("question-D1_Q1")).toBeInTheDocument();
    expect(localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY)).toBeNull();

    press("Digit2");
    expect(await screen.findByTestId("feedback-D1_Q1")).toBeInTheDocument();
    const progress = JSON.parse(localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY) ?? "{}");
    expect(progress.responses).toEqual([
      expect.objectContaining({ exerciseId: "D1_Q1", kind: "single_choice", selectedIds: ["B"] }),
    ]);
  });

  it("never advances from feedback until a right-column button is pressed", async () => {
    renderLesson();
    press("Digit2");
    await screen.findByTestId("question-D1_Q1");
    press("Digit1");
    press("Digit1");
    await screen.findByTestId("feedback-D1_Q1");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId("feedback-D1_Q1")).toBeInTheDocument();

    press("Digit4");
    await waitFor(() => expect(screen.getByTestId("question-D1_Q2")).toBeInTheDocument());
  });

  it("resumes at the first unanswered question after a reload", async () => {
    localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeDay: 1,
      completedDays: [],
      responses: [{
        exerciseId: "D1_Q1",
        kind: "single_choice",
        selectedIds: ["B"],
        responseMs: 1200,
        completedAt: "2026-08-10T00:00:00.000Z",
      }],
    }));
    renderLesson();

    press("Digit2");
    expect(await screen.findByTestId("question-D1_Q2")).toBeInTheDocument();
  });

  it("clears stale day responses before a requested fresh run", async () => {
    seedAnsweredDayOneQuestions(5);
    renderLesson(false, "/lesson?day=1&restart=1");

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY) ?? "{}");
      expect(stored.responses).toEqual([]);
    });

    press("Digit2");
    expect(await screen.findByTestId("question-D1_Q1")).toBeInTheDocument();
    press("Digit1");
    press("Digit1");
    expect(await screen.findByTestId("feedback-D1_Q1")).toBeInTheDocument();
    press("Digit2");
    expect(await screen.findByTestId("question-D1_Q2")).toBeInTheDocument();
  });

  it("resets to the new day intro and its stored resume point after a query-only navigation", async () => {
    const responses = [
      ...getOfflineQuestionsForDay(1).slice(0, 5),
      ...getOfflineQuestionsForDay(2).slice(0, 1),
    ].map((question, index) => ({
      exerciseId: question.exercise.id,
      kind: question.responseType,
      selectedIds: [],
      responseMs: 1_000 + index,
      completedAt: `2026-08-10T00:00:0${index}.000Z`,
    }));
    localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeDay: 1,
      completedDays: [],
      responses,
    }));
    renderLesson(true);
    press("Digit2");
    await screen.findByTestId("question-D1_Q6");
    press("Digit1");

    fireEvent.click(screen.getByRole("button", { name: "open day two" }));

    await waitFor(() => {
      expect(document.querySelector('[data-screen="lesson-start"]')).toBeInTheDocument();
    });
    expect(screen.getByText("2일차")).toBeInTheDocument();
    press("Digit2");
    expect(await screen.findByTestId("question-D2_Q2")).toHaveAttribute(
      "data-question-kind",
      "single_choice",
    );
  });

  it("recovers an all-answered day without repeating question one", async () => {
    const responses = getOfflineQuestionsForDay(1).map((question, index) => ({
      exerciseId: question.exercise.id,
      kind: question.responseType,
      selectedIds: [],
      responseMs: 1_000 + index,
      completedAt: `2026-08-10T00:00:0${index}.000Z`,
    }));
    localStorage.setItem(OFFLINE_PROGRESS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeDay: 1,
      completedDays: [],
      responses,
    }));

    renderLesson();

    expect(await screen.findByTestId("result-route")).toBeInTheDocument();
    expect(screen.queryByTestId("question-D1_Q1")).not.toBeInTheDocument();
    const recovered = JSON.parse(
      localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY) ?? "{}",
    );
    expect(recovered.completedDays).toEqual([1]);
    expect(recovered.responses).toHaveLength(6);
  });

  it("keeps feedback retry durable across a reload", async () => {
    const firstRender = renderLesson();
    press("Digit2");
    await screen.findByTestId("question-D1_Q1");
    press("Digit1");
    press("Digit1");
    await screen.findByTestId("feedback-D1_Q1");

    press("Digit1");
    await screen.findByTestId("question-D1_Q1");
    const afterRetry = JSON.parse(
      localStorage.getItem(OFFLINE_PROGRESS_STORAGE_KEY) ?? "{}",
    );
    expect(afterRetry.responses).toEqual([]);

    firstRender.unmount();
    renderLesson();
    press("Digit2");
    expect(await screen.findByTestId("question-D1_Q1")).toBeInTheDocument();
  });

  it("stops narration before starting or retrying voice capture", async () => {
    seedAnsweredDayOneQuestions(4);
    renderLesson();
    press("Digit2");
    await screen.findByTestId("question-D1_Q5");

    vi.mocked(audioManager.stopNarration).mockClear();
    vi.mocked(audioManager.playUi).mockClear();
    press("Digit2");
    expect(audioManager.stopNarration).toHaveBeenCalledTimes(1);
    expect(audioManager.playUi).toHaveBeenCalledWith("recordStart");
    expect(vi.mocked(audioManager.stopNarration).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(audioManager.playUi).mock.invocationCallOrder[0],
    );

    press("Digit2");
    expect(document.querySelector('[data-voice-stage="review"]')).toBeInTheDocument();
    vi.mocked(audioManager.stopNarration).mockClear();
    vi.mocked(audioManager.playUi).mockClear();
    press("Digit1");
    expect(audioManager.stopNarration).toHaveBeenCalledTimes(1);
    expect(audioManager.playUi).toHaveBeenCalledWith("recordStart");
  });

  it("does not submit a voice answer from an immediate late stop press after timeout", async () => {
    vi.useFakeTimers();
    seedAnsweredDayOneQuestions(4);
    renderLesson();
    press("Digit2");
    expect(screen.getByTestId("question-D1_Q5")).toBeInTheDocument();
    press("Digit2");
    expect(document.querySelector('[data-voice-stage="recording"]')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(25_000));
    expect(document.querySelector('[data-voice-stage="review"]')).toBeInTheDocument();
    press("Digit2");
    expect(document.querySelector('[data-voice-stage="review"]')).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-D1_Q5")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(750));
    press("Digit2");
    expect(screen.getByTestId("feedback-D1_Q5")).toBeInTheDocument();
  });

  it("marks an already confirmed sequence button as unavailable in the guide", async () => {
    seedAnsweredDayOneQuestions(5);
    renderLesson();
    press("Digit2");
    await screen.findByTestId("question-D1_Q6");

    press("Digit1");
    press("Digit1");

    const guide = screen.getByLabelText("물리 버튼 안내");
    const topLeftGuide = within(guide).getByText("A").closest(".guide-key");
    expect(topLeftGuide).toHaveTextContent("선택 완료");
  });

  it("keeps final-question feedback until a right-column next press", async () => {
    seedAnsweredDayOneQuestions(5);
    renderLesson();
    press("Digit2");
    await screen.findByTestId("question-D1_Q6");

    for (const code of [
      "Digit1",
      "Digit1",
      "Digit2",
      "Digit2",
      "Digit3",
      "Digit3",
      "Digit2",
    ] as const) {
      press(code);
    }

    expect(await screen.findByTestId("feedback-D1_Q6")).toBeInTheDocument();
    expect(screen.queryByTestId("result-route")).not.toBeInTheDocument();
    press("Digit2");
    expect(await screen.findByTestId("result-route")).toBeInTheDocument();
  });
});
