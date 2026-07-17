import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { FeedbackTray } from "@/features/lessons/ui/FeedbackTray";
import { MascotBubble } from "@/components/MascotBubble";
import { ExerciseRenderer } from "@/features/lessons/ExerciseRenderer";
import {
  buildDailySessionExercises,
  parseHaruWeekDay,
} from "@/features/lessons/sessionBuilder";
import { mockExercises } from "@/data/mockExercises";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  getHaruWeekPlan,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import type {
  HaruScenarioAdminResponse,
  HaruScenarioLiveResponse,
} from "@/features/lessons/exerciseTypes/HaruScenarioQuestion";
import {
  abandonHaruDemoSession,
  completeHaruDemoSession,
  getHaruDemoSessions,
  recordHaruDemoResponse,
  startHaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";
import {
  abandonHaruAdminUsageSession,
  completeHaruAdminUsageSession,
  presentHaruAdminQuestion,
  recordHaruAdminResponse,
  startHaruAdminUsageSession,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import { resolveHaruExercises } from "@/features/lessons/haruLivePersonalization";
import { getLocalizedText } from "@/utils/localizedText";

export default function LessonScreen() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialExerciseId = searchParams.get("captureExerciseId");
  const requestedDay = parseHaruWeekDay(
    searchParams.get("day") ?? searchParams.get("demoDay"),
  );
  const storedSessions = getHaruDemoSessions();
  const nextIncompleteDay = HARU_WEEK_PLAN.find(
    (plan) =>
      !storedSessions.some(
        (session) => session.day === plan.day && session.status === "completed",
      ),
  )?.day;
  const activeDay = initialExerciseId
    ? requestedDay
    : (requestedDay ?? nextIncompleteDay ?? 7);

  return (
    <LessonSession
      key={`${initialExerciseId ?? "routine"}:${activeDay ?? "default"}`}
      initialExerciseId={initialExerciseId}
      activeDay={activeDay}
    />
  );
}

interface LessonSessionProps {
  initialExerciseId: string | null;
  activeDay?: HaruWeekDay;
}

function LessonSession({ initialExerciseId, activeDay }: LessonSessionProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const weekPlan = activeDay ? getHaruWeekPlan(activeDay) : undefined;
  const initialSessions = getHaruDemoSessions();
  const existingSession = activeDay
    ? initialSessions.find((session) => session.day === activeDay)
    : undefined;

  const [resolvedExercises] = useState(() => {
    const baseExercises = buildDailySessionExercises({
      exercises: mockExercises,
      initialExerciseId,
      dayOverride: activeDay,
    });
    if (initialExerciseId || !activeDay) {
      return baseExercises.map((exercise) => ({
        exercise,
        personalization: { kind: "none" as const },
      }));
    }
    return resolveHaruExercises(baseExercises, initialSessions);
  });
  const exercises = resolvedExercises.map((resolved) => resolved.exercise);
  const firstUnansweredIndex = exercises.findIndex(
    (exercise) =>
      !existingSession?.responses.some((response) => response.questionId === exercise.id),
  );
  const [currentIndex, setCurrentIndex] = useState(
    existingSession?.status === "in_progress" && firstUnansweredIndex >= 0
      ? firstUnansweredIndex
      : 0,
  );
  const [globalState, setGlobalState] = useState<ExerciseState>("awaiting_answer");
  const [hasStarted, setHasStarted] = useState(
    Boolean(initialExerciseId || existingSession?.status === "in_progress"),
  );
  const [responseFeedback, setResponseFeedback] = useState("");
  const pendingAdminWritesRef = useRef(new Set<Promise<unknown>>());

  const currentExercise = exercises[currentIndex];
  const currentExplanation = getLocalizedText(currentExercise?.explanation, i18n.language);
  const completedResultPath = activeDay ? `/result?day=${activeDay}` : "/result";

  const finishSession = useCallback(async () => {
    if (activeDay && weekPlan) {
      await Promise.allSettled([...pendingAdminWritesRef.current]);
      const completionMessage = getLocalizedText(
        weekPlan.completionMessage,
        i18n.language,
      );
      const completedAdminSession = completeHaruAdminUsageSession(
        activeDay,
        completionMessage,
      );
      if (
        HARU_DEMO_PERSONA.consents.longitudinalUsageStorage &&
        completedAdminSession?.completion_status !== "completed"
      ) {
        return;
      }
      const completedSession = completeHaruDemoSession(
        activeDay,
        completionMessage,
      );
      if (completedSession?.status !== "completed") return;
    }
    navigate(completedResultPath, { state: { completed: true } });
  }, [activeDay, completedResultPath, i18n.language, navigate, weekPlan]);

  // A reload can happen after the final response was persisted but before the
  // completion transition ran. Recover that narrow state instead of reopening
  // question one and overwriting the finished response set.
  useEffect(() => {
    if (
      initialExerciseId ||
      !activeDay ||
      existingSession?.status !== "in_progress" ||
      exercises.length === 0 ||
      firstUnansweredIndex >= 0
    ) {
      return;
    }
    finishSession();
  }, [
    activeDay,
    existingSession?.status,
    exercises.length,
    finishSession,
    firstUnansweredIndex,
    initialExerciseId,
  ]);

  const handleClose = () => {
    if (activeDay) {
      abandonHaruDemoSession(activeDay);
      abandonHaruAdminUsageSession(activeDay);
    }
    navigate("/result");
  };

  const handleContinue = () => {
    if (currentIndex + 1 < exercises.length) {
      setCurrentIndex(currentIndex + 1);
      setGlobalState("awaiting_answer");
      setResponseFeedback("");
    } else {
      finishSession();
    }
  };

  const handleRetry = () => {
    setGlobalState("awaiting_answer");
    setResponseFeedback("");
  };

  const handleHaruResponse = (response: HaruScenarioLiveResponse) => {
    setResponseFeedback(response.feedback);
    if (!activeDay) return;

    const { feedback, recognitionError, ...safeResponse } = response;
    void feedback;
    const personalization = resolvedExercises[currentIndex]?.personalization;
    recordHaruDemoResponse(activeDay, {
      ...safeResponse,
      ...(recognitionError ? { recognitionError } : {}),
      ...(personalization ? { personalization } : {}),
    });
  };

  const handleHaruAdminResponse = (response: HaruScenarioAdminResponse) => {
    if (!activeDay || initialExerciseId) return;
    const exercise = exercises[currentIndex];
    if (!exercise || exercise.id !== response.questionId) return;
    const personalization = resolvedExercises[currentIndex]?.personalization;
    const pendingWrite = recordHaruAdminResponse(
      activeDay,
      exercise,
      i18n.language,
      response,
      personalization,
    );
    pendingAdminWritesRef.current.add(pendingWrite);
    void pendingWrite
      .finally(() => {
        pendingAdminWritesRef.current.delete(pendingWrite);
      })
      .catch(() => undefined);
  };

  const handleStartLesson = useCallback(() => {
    if (activeDay && weekPlan) {
      const session = startHaruDemoSession(activeDay, weekPlan.exerciseIds);
      startHaruAdminUsageSession(activeDay);
      if (session.status === "completed") {
        navigate(completedResultPath);
        return;
      }
      const nextIndex = exercises.findIndex(
        (exercise) =>
          !session.responses.some((response) => response.questionId === exercise.id),
      );
      if (nextIndex >= 0) setCurrentIndex(nextIndex);
    }
    setHasStarted(true);
  }, [
    activeDay,
    completedResultPath,
    exercises,
    navigate,
    setCurrentIndex,
    setHasStarted,
    weekPlan,
  ]);

  // Splash auto-starts after a short beat (today's concept shows first). Any tap
  // on the splash also starts immediately — no start button to hunt for.
  useEffect(() => {
    if (hasStarted) return;
    const timer = setTimeout(handleStartLesson, 10000);
    return () => clearTimeout(timer);
  }, [handleStartLesson, hasStarted]);

  useEffect(() => {
    if (!hasStarted || !activeDay || initialExerciseId || !currentExercise) return;
    presentHaruAdminQuestion(
      activeDay,
      currentExercise,
      i18n.language,
      resolvedExercises[currentIndex]?.personalization,
    );
  }, [
    activeDay,
    currentExercise,
    currentIndex,
    hasStarted,
    i18n.language,
    initialExerciseId,
    resolvedExercises,
  ]);

  // Auto-advance after a final outcome. Hint feedback stays put because its
  // action explicitly promises the learner another attempt.
  useEffect(() => {
    if (
      globalState !== "correct_feedback" &&
      globalState !== "incorrect_feedback"
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (currentIndex + 1 < exercises.length) {
        setCurrentIndex(currentIndex + 1);
        setGlobalState("awaiting_answer");
        setResponseFeedback("");
      } else {
        finishSession();
      }
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [
    finishSession,
    globalState,
    currentIndex,
    exercises.length,
    setGlobalState,
    setCurrentIndex,
  ]);

  if (!hasStarted) {
    return (
      <div
        data-screen="lesson-start"
        data-week-day={activeDay ?? "default"}
        data-testid="lesson-start-screen"
        role="button"
        tabIndex={0}
        aria-label={t("lesson.start.tapToStart")}
        onClick={handleStartLesson}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleStartLesson();
          }
        }}
        className="flex min-h-[100dvh] cursor-pointer flex-col items-center justify-center bg-background px-6 text-center"
      >
        <img
          src="/assets/haru/logo.png"
          alt={t("appTitle")}
          className="mb-8 h-24 w-auto max-w-[80vw] object-contain sm:h-28"
        />
        <p className="text-base font-semibold text-primary uppercase tracking-[0.02em]">
          {weekPlan
            ? `${getLocalizedText(weekPlan.weekday, i18n.language)} · ${t("lesson.start.overline")}`
            : t("lesson.start.overline")}
        </p>
        <h1 className="mt-4 text-[clamp(2.25rem,7vw,3.25rem)] leading-tight font-extrabold text-foreground">
          {weekPlan
            ? getLocalizedText(weekPlan.title, i18n.language)
            : t("lesson.start.concept")}
        </h1>
        <div className="mt-10">
          <MascotBubble
            mood="calm"
            message={
              weekPlan
                ? getLocalizedText(weekPlan.greeting, i18n.language)
                : t("lesson.start.mascotMessage")
            }
            mascotSrc="/assets/haru/buddy/wave_2.png"
            frameless
          />
        </div>
        {activeDay === 1 && (
          <section
            data-testid="registered-profile-context"
            className="mt-8 w-full max-w-sm rounded-3xl border-2 border-primary-200 bg-white px-5 py-4 text-left shadow-sm"
          >
            <p className="text-sm font-extrabold uppercase tracking-wide text-primary-700">
              {t("lesson.start.profileBadge")}
            </p>
            <p className="mt-1 text-lg font-extrabold text-ink">
              {t("lesson.start.profileConfirmed", {
                name: getLocalizedText(HARU_DEMO_PERSONA.displayName, i18n.language),
              })}
            </p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-muted-foreground">
              {t("lesson.start.profileSource")}
            </p>
          </section>
        )}
        <p className="mt-10 text-base text-muted-foreground">{t("lesson.start.autoHint")}</p>
      </div>
    );
  }

  if (!currentExercise) return null;

  return (
    <div
      data-screen="lesson"
      data-week-day={activeDay ?? "default"}
      data-exercise-id={currentExercise.id}
      className="flex min-h-[100dvh] flex-col bg-background pb-32"
    >
      <header className="flex items-center gap-4 px-4 py-6 w-full max-w-md mx-auto">
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100 min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label={t("lesson.close")}
        >
          <X size={28} strokeWidth={2.5} />
        </button>
        <ProgressBar
          value={currentIndex + 1}
          max={exercises.length}
          className="flex-1"
        />
      </header>

      <main className="flex flex-col flex-1 w-full max-w-md mx-auto px-4 mt-2">
        <ExerciseRenderer
          exercise={currentExercise}
          globalState={globalState}
          setGlobalState={setGlobalState}
          onComplete={handleContinue}
          onHaruResponse={handleHaruResponse}
          onHaruAdminResponse={handleHaruAdminResponse}
        />
      </main>

      {globalState === "correct_feedback" && (
        <FeedbackTray
          variant="correct"
          title={t("feedback.correct.title")}
          body={responseFeedback || currentExplanation}
          primaryActionLabel={t("feedback.continue")}
          onPrimaryAction={handleContinue}
        />
      )}

      {globalState === "incorrect_feedback" && (
        <FeedbackTray
          variant="incorrect"
          title={t("feedback.incorrect.title")}
          body={responseFeedback || t("feedback.incorrect.moveOn")}
          primaryActionLabel={t("feedback.continue")}
          onPrimaryAction={handleContinue}
        />
      )}

      {globalState === "hint_feedback" && (
        <FeedbackTray
          variant="hint"
          title={t("feedback.incorrect.title")}
          body={t("feedback.incorrect.retry")}
          primaryActionLabel={t("feedback.incorrect.retry")}
          onPrimaryAction={handleRetry}
        />
      )}
    </div>
  );
}
