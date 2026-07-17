import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "@/i18n";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import { mockExercises } from "@/data/mockExercises";
import LessonScreen from "@/app/lesson/LessonScreen";
import { getLocalizedText } from "@/utils/localizedText";
import {
  completeHaruDemoSession,
  getHaruDemoSessions,
  recordHaruDemoResponse,
  startHaruDemoSession,
  type HaruDemoResponse,
} from "@/features/lessons/haruDemoSessionStorage";
import {
  getHaruAdminUsageRecord,
  presentHaruAdminQuestion,
  recordHaruAdminResponse,
  startHaruAdminUsageSession,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";
import "@/i18n";

describe("LessonScreen", () => {
  const responseFor = (
    question: (typeof HARU_WEEK_QUESTION_META)[number],
  ): HaruDemoResponse => ({
    questionId: question.exerciseId,
    responseType: question.responseType,
    responseTimeMs: question.recordedResponse.responseTimeMs,
    isCorrect: question.recordedResponse.isCorrect,
    ...(question.recordedResponse.selectedOptionId
      ? { selectedOptionId: question.recordedResponse.selectedOptionId }
      : {}),
    ...(question.recordedResponse.submittedSequence
      ? { submittedSequence: [...question.recordedResponse.submittedSequence] }
      : {}),
    ...(question.responseType === "voice"
      ? {
          voiceDurationSeconds: question.recordedResponse.voiceDurationSeconds ?? 0,
          sttStatus: question.recordedResponse.sttStatus ?? "failed",
        }
      : {}),
  });

  const completeStoredDay = (day: HaruWeekDay) => {
    const plan = HARU_WEEK_PLAN[day - 1];
    startHaruDemoSession(day, plan.exerciseIds);
    const existingIds = new Set(
      getHaruDemoSessions()
        .find((session) => session.day === day)
        ?.responses.map((response) => response.questionId) ?? [],
    );
    HARU_WEEK_QUESTION_META.filter((question) => question.day === day).forEach(
      (question) => {
        if (!existingIds.has(question.exerciseId)) {
          recordHaruDemoResponse(day, responseFor(question));
        }
      },
    );
    return completeHaruDemoSession(day, "완료");
  };

  const answerAdminDay = async (day: HaruWeekDay) => {
    startHaruAdminUsageSession(day);
    for (const question of HARU_WEEK_QUESTION_META.filter(
      (candidate) => candidate.day === day,
    )) {
      const exercise = haru7DayExercises.find(
        (candidate) => candidate.id === question.exerciseId,
      );
      if (!exercise) throw new Error(`Missing exercise ${question.exerciseId}`);
      presentHaruAdminQuestion(day, exercise, "ko", { kind: "none" });
      await recordHaruAdminResponse(day, exercise, "ko", {
        questionId: question.exerciseId,
        responseType: question.responseType,
        responseTimeMs: question.recordedResponse.responseTimeMs,
        isCorrect: question.recordedResponse.isCorrect,
        feedback: "응답 완료",
        ...(question.recordedResponse.selectedOptionId
          ? { selectedOptionId: question.recordedResponse.selectedOptionId }
          : {}),
        ...(question.recordedResponse.submittedSequence
          ? { submittedSequence: [...question.recordedResponse.submittedSequence] }
          : {}),
        ...(question.responseType === "voice"
          ? {
              voiceDurationSeconds:
                question.recordedResponse.voiceDurationSeconds ?? 0,
              sttStatus: question.recordedResponse.sttStatus ?? "failed",
            }
          : {}),
      });
    }
  };

  const renderWithRoute = (path: string) => {
    return render(
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/lesson" element={<LessonScreen />} />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/result" element={<div>Result</div>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the selected day's personalized splash before start", () => {
    renderWithRoute("/lesson?day=1");

    expect(screen.getByTestId("lesson-start-screen")).toBeInTheDocument();
    expect(
      screen.getByText(getLocalizedText(HARU_WEEK_PLAN[0].title, i18n.language)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(getLocalizedText(HARU_WEEK_PLAN[0].greeting, i18n.language)),
    ).toBeInTheDocument();
    const profileContext = screen.getByTestId("registered-profile-context");
    expect(profileContext).toHaveTextContent(
      i18n.t("lesson.start.profileConfirmed", {
        name: getLocalizedText(HARU_DEMO_PERSONA.displayName, i18n.language),
      }),
    );
    expect(profileContext).toHaveTextContent(i18n.t("lesson.start.profileSource"));
    expect(profileContext).not.toHaveTextContent("부산 영도");
    // The first exercise is not shown on the splash.
    const firstExercisePrompt = getLocalizedText(haru7DayExercises[0].prompt, i18n.language);
    expect(screen.queryByText(firstExercisePrompt)).not.toBeInTheDocument();
  });

  it("hides registered profile context and name when personalization is off", () => {
    act(() => {
      updateHaruConsent({ personalizedQuestionUse: false });
    });

    renderWithRoute("/lesson?day=1");

    expect(screen.queryByTestId("registered-profile-context")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        getLocalizedText(HARU_DEMO_PERSONA.displayName, i18n.language),
        { exact: false },
      ),
    ).not.toBeInTheDocument();
  });

  it("removes visible profile context when personalization is withdrawn live", async () => {
    renderWithRoute("/lesson?day=1");
    expect(screen.getByTestId("registered-profile-context")).toBeInTheDocument();

    act(() => {
      updateHaruConsent({ personalizedQuestionUse: false });
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId("registered-profile-context"),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText(
        getLocalizedText(HARU_DEMO_PERSONA.displayName, i18n.language),
        { exact: false },
      ),
    ).not.toBeInTheDocument();
  });

  it("opens the canonical first day when no day query is supplied", () => {
    renderWithRoute("/lesson");

    expect(screen.getByTestId("lesson-start-screen")).toHaveAttribute(
      "data-week-day",
      "1",
    );
    expect(
      screen.getByText(getLocalizedText(HARU_WEEK_PLAN[0].title, i18n.language)),
    ).toBeInTheDocument();
  });

  it("opens the first unfinished day from the actual session record", () => {
    completeStoredDay(1);

    renderWithRoute("/lesson");

    expect(screen.getByTestId("lesson-start-screen")).toHaveAttribute(
      "data-week-day",
      "2",
    );
    expect(
      screen.getByText(getLocalizedText(HARU_WEEK_PLAN[1].title, i18n.language)),
    ).toBeInTheDocument();
  });

  it("starts the lesson when the splash is tapped", async () => {
    renderWithRoute("/lesson?day=1");

    fireEvent.click(screen.getByTestId("lesson-start-screen"));

    expect(
      await screen.findByText(
        getLocalizedText(haru7DayExercises[0].prompt, i18n.language),
      ),
    ).toBeInTheDocument();
    expect(getHaruDemoSessions()).toEqual([
      expect.objectContaining({
        day: 1,
        status: "in_progress",
        questionIds: [...HARU_WEEK_PLAN[0].exerciseIds],
      }),
    ]);
  });

  it("does not claim a prior-day memory when the source record is missing", async () => {
    renderWithRoute("/lesson?demoDay=7");

    fireEvent.click(screen.getByTestId("lesson-start-screen"));

    expect(await screen.findByText("오늘 기분은 어떠세요?")).toBeInTheDocument();
    expect(
      screen.queryByText("어제 오후에는 집에서 쉬었다고 하셨어요. 오늘 기분은 어떠세요?"),
    ).not.toBeInTheDocument();
  });

  it("skips intro when captureExerciseId is present", async () => {
    const firstExercisePrompt = getLocalizedText(mockExercises[0].prompt, i18n.language);
    renderWithRoute("/lesson?captureExerciseId=ex_1");

    expect(
      screen.queryByRole("button", { name: i18n.t("lesson.start.startButton") }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(firstExercisePrompt)).toBeInTheDocument();
  });

  it("does not show a positive answer explanation after a miss", () => {
    const exercise = haru7DayExercises.find((item) => item.id === "D1_Q2");
    const wrongLabels = exercise?.payload.options
      ?.filter((option) => option.id !== exercise.correctAnswer)
      .slice(0, 1)
      .map((option) => getLocalizedText(option.label, i18n.language));
    renderWithRoute("/lesson?captureExerciseId=D1_Q2");

    fireEvent.click(screen.getByText(wrongLabels?.[0] ?? ""));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));

    expect(screen.getByText(i18n.t("feedback.incorrect.moveOn"))).toBeInTheDocument();
    expect(
      screen.queryByText(getLocalizedText(exercise?.explanation, i18n.language)),
    ).not.toBeInTheDocument();
  });

  it("stores the selected first-day response in the safe session record", () => {
    renderWithRoute("/lesson?day=1");
    fireEvent.click(screen.getByTestId("lesson-start-screen"));
    fireEvent.click(screen.getByRole("button", { name: "좋음" }));

    expect(getHaruDemoSessions()[0].responses).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));

    expect(getHaruDemoSessions()[0].responses).toEqual([
      expect.objectContaining({
        questionId: "D1_Q1",
        responseType: "single_choice",
        selectedOptionId: "B",
        isCorrect: null,
      }),
    ]);
    expect(
      getHaruAdminUsageRecord()?.sessions[0].question_records[0].response,
    ).toEqual(
      expect.objectContaining({
        input_mode: "touch",
        selected_choice: { button: "B", label: "좋음" },
        is_valid: true,
      }),
    );
  });

  it("resumes at the first unanswered question without erasing earlier answers", () => {
    startHaruDemoSession(1, HARU_WEEK_PLAN[0].exerciseIds);
    recordHaruDemoResponse(1, {
      questionId: "D1_Q1",
      responseType: "single_choice",
      selectedOptionId: "B",
      responseTimeMs: 6_000,
      isCorrect: null,
    });
    recordHaruDemoResponse(1, {
      questionId: "D1_Q2",
      responseType: "single_choice",
      selectedOptionId: "A",
      responseTimeMs: 7_000,
      isCorrect: true,
    });

    renderWithRoute("/lesson?day=1");

    expect(screen.getByText("영자 어르신이 태어나고 자란 고향은 어디인가요?")).toBeInTheDocument();
    expect(getHaruDemoSessions()[0].responses.map((response) => response.questionId)).toEqual([
      "D1_Q1",
      "D1_Q2",
    ]);
  });

  it("renders a later recall question from the stored prior voice facts", () => {
    startHaruDemoSession(1, HARU_WEEK_PLAN[0].exerciseIds);
    recordHaruDemoResponse(1, {
      questionId: "D1_Q5",
      responseType: "voice",
      responseTimeMs: 10_000,
      isCorrect: null,
      voiceDurationSeconds: 8,
      sttStatus: "completed",
      derivedAnnotations: [
        { entityType: "장소", value: "유성시장" },
        { entityType: "구매물품", value: "가지" },
      ],
    });
    completeStoredDay(1);

    renderWithRoute("/lesson?day=2");
    fireEvent.click(screen.getByTestId("lesson-start-screen"));
    const firstMood = screen.getByRole("button", { name: "매우 좋음" });
    fireEvent.click(firstMood);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("feedback.continue") }));
    fireEvent.click(screen.getByRole("button", { name: "월요일" }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("exercise.check") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("feedback.continue") }));

    expect(screen.getByText(/어제 유성시장에서 샀다고/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "가지" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "애호박" })).not.toBeInTheDocument();
  });

  it("recovers a final persisted answer by completing instead of overwriting it", async () => {
    startHaruDemoSession(1, HARU_WEEK_PLAN[0].exerciseIds);
    HARU_WEEK_QUESTION_META.filter((question) => question.day === 1).forEach((question) => {
      recordHaruDemoResponse(1, responseFor(question));
    });
    await answerAdminDay(1);

    renderWithRoute("/lesson?day=1");

    expect(await screen.findByText("Result")).toBeInTheDocument();
    expect(getHaruDemoSessions()[0]).toEqual(
      expect.objectContaining({ status: "completed", questionCount: 6 }),
    );
    expect(getHaruDemoSessions()[0].responses).toHaveLength(6);
  });

  it("keeps the safe session in progress when the linked admin record is incomplete", async () => {
    startHaruDemoSession(1, HARU_WEEK_PLAN[0].exerciseIds);
    HARU_WEEK_QUESTION_META.filter((question) => question.day === 1).forEach((question) => {
      recordHaruDemoResponse(1, responseFor(question));
    });
    startHaruAdminUsageSession(1);

    renderWithRoute("/lesson?day=1");

    await waitFor(() => {
      expect(
        getHaruAdminUsageRecord()?.sessions[0]?.question_records,
      ).toHaveLength(1);
    });
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
    expect(getHaruDemoSessions()[0].status).toBe("in_progress");
  });
});
