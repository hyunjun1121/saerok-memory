import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
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
  HARU_WEEK_QUESTION_META,
  HARU_WEEK_PLAN,
  getHaruWeekPlan,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import { useHaruConsent } from "@/features/profile/useHaruConsent";
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
import { getLocalizedText, getSpeechLanguage, normalizeLanguage } from "@/utils/localizedText";
import { getRuntimeMarketConfig } from "@/config/market";
import {
  captureHaruTelemetry,
  createHaruLessonTelemetryTracker,
  flushHaruTelemetry,
  hashTelemetryContent,
} from "@/features/analytics/client";
import type { TelemetryInputMode } from "@/features/analytics/types";
import {
  HARU_VOICE_EXPERIENCE,
  resolveSttPipelineVersion,
  resolveVoiceOutcomeReason,
} from "@/features/speech/voiceExperience";
import { playHaruDayOneNarration } from "@/features/speech/haruNarration";
import { speakCalmly } from "@/hooks/interactionFeedback";

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
  const consent = useHaruConsent();
  const marketConfig = getRuntimeMarketConfig();
  const personalizedQuestionUse = consent.personalizedQuestionUse;
  const weekPlan = activeDay
    ? getHaruWeekPlan(activeDay, marketConfig.market)
    : undefined;
  const [telemetryTracker] = useState(createHaruLessonTelemetryTracker);
  const [initialSessions] = useState(getHaruDemoSessions);
  const existingSession = activeDay
    ? initialSessions.find((session) => session.day === activeDay)
    : undefined;

  const baseExercises = useMemo(
    () =>
      buildDailySessionExercises({
        exercises: mockExercises,
        initialExerciseId,
        dayOverride: activeDay,
      }),
    [activeDay, initialExerciseId],
  );
  const resolvedExercises = useMemo(() => {
    if (initialExerciseId || !activeDay) {
      return baseExercises.map((exercise) => ({
        exercise,
        personalization: { kind: "none" as const },
      }));
    }
    return resolveHaruExercises(
      baseExercises,
      initialSessions,
      personalizedQuestionUse,
    );
  }, [activeDay, baseExercises, initialExerciseId, initialSessions, personalizedQuestionUse]);
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
  const telemetryInputModeRef = useRef<TelemetryInputMode>("touch");

  const currentExercise = exercises[currentIndex];
  const currentExplanation = getLocalizedText(currentExercise?.explanation, i18n.language);
  const completedResultPath = activeDay ? `/result?day=${activeDay}` : "/result";

  const finishSession = useCallback(async () => {
    void telemetryTracker?.completeQuestion();
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
        getHaruConsent().longitudinalUsageStorage &&
        completedAdminSession?.completion_status !== "completed"
      ) {
        return;
      }
      const completedSession = completeHaruDemoSession(
        activeDay,
        completionMessage,
      );
      if (completedSession?.status !== "completed") return;
      if (activeDay === 1) {
        void playHaruDayOneNarration(normalizeLanguage(i18n.language), "day.1.completion").then((played) => {
          if (!played) speakCalmly(completionMessage, getSpeechLanguage(i18n.language));
        });
      }
    }
    void telemetryTracker?.completeRoutine();
    void flushHaruTelemetry();
    navigate(completedResultPath, { state: { completed: true } });
  }, [
    activeDay,
    completedResultPath,
    i18n.language,
    navigate,
    telemetryTracker,
    weekPlan,
  ]);

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
    void telemetryTracker?.exit("user");
    void flushHaruTelemetry();
    navigate("/result");
  };

  const handleContinue = useCallback(() => {
    if (currentIndex + 1 < exercises.length) {
      void telemetryTracker?.completeQuestion();
      setCurrentIndex(currentIndex + 1);
      setGlobalState("awaiting_answer");
      setResponseFeedback("");
    } else {
      void finishSession();
    }
  }, [
    currentIndex,
    exercises.length,
    finishSession,
    setCurrentIndex,
    setGlobalState,
    setResponseFeedback,
    telemetryTracker,
  ]);

  const handleTelemetryClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const inputMode: TelemetryInputMode = event.detail === 0 ? "key_action" : "touch";
      telemetryInputModeRef.current = inputMode;
      void telemetryTracker?.recordInteraction(inputMode);

      const target = event.target instanceof Element ? event.target : null;
      const choice = target?.closest<HTMLElement>("[data-choice-id]");
      const choiceId = choice?.dataset.choiceId;
      if (!choice || !choiceId) return;
      const wasSelected = choice.getAttribute("aria-pressed") === "true";
      const selectedCount = event.currentTarget.querySelectorAll(
        '[data-choice-id][aria-pressed="true"]',
      ).length;
      void telemetryTracker?.recordChoice(
        choiceId,
        !wasSelected,
        Math.max(0, selectedCount + (wasSelected ? -1 : 1)),
      );
    },
    [telemetryTracker],
  );

  const handleRetry = () => {
    void telemetryTracker?.useHint("retry_prompt");
    void telemetryTracker?.retry();
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
    const inputMode: TelemetryInputMode =
      response.responseType === "voice"
        ? "voice"
        : response.inputMode === "physical_button" ||
            response.sequenceButtonEvents?.some(
              (event) => event.inputMode === "physical_button",
            )
          ? "key_action"
          : "touch";
    telemetryInputModeRef.current = inputMode;
    void telemetryTracker?.confirmAnswer({
      inputMode,
      responseIds:
        response.responseType === "single_choice"
          ? response.selectedOptionId
            ? [response.selectedOptionId]
            : []
          : response.responseType === "button_sequence"
            ? [...(response.submittedSequence ?? [])]
            : [],
      result:
        response.isCorrect === true
          ? "correct"
          : response.isCorrect === false
            ? "incorrect"
          : "unscored",
    });
    if (response.responseType === "button_sequence") {
      const events = response.sequenceButtonEvents ?? [];
      events.forEach((event, index) => {
        void captureHaruTelemetry(
          "sequence_changed",
          {
            action: "add",
            itemId: event.optionId,
            position: index,
            itemCount: index + 1,
          },
          {
            routineSessionId: telemetryTracker?.getSessionId(),
            questionInstanceId: telemetryTracker?.getQuestionInstanceId(),
          },
        );
      });
    }
    if (response.responseType === "voice") {
      const durationMs = Math.max(
        0,
        Math.round((response.voiceDurationSeconds ?? 0) * 1000),
      );
      const recordingEndedAt = Date.parse(response.recordingEndedAt ?? "");
      const sttProcessedAt = Date.parse(response.sttProcessedAt ?? "");
      const sttLatencyMs =
        Number.isFinite(recordingEndedAt) && Number.isFinite(sttProcessedAt)
          ? Math.max(0, Math.round(sttProcessedAt - recordingEndedAt))
          : undefined;
      void telemetryTracker?.recordVoiceCaptureStatus({
        ...HARU_VOICE_EXPERIENCE,
        sttPipelineVersion: resolveSttPipelineVersion(
          response.sttPreprocessingVersion,
        ),
        phase: durationMs > 0 ? "completed" : "failed",
        durationMs,
        sttStatus:
          response.recognitionError === "stt-pending"
            ? "queued"
            : response.sttStatus === "completed"
              ? "completed"
              : response.sttNoSpeech
                ? "no_speech"
                : "failed",
        ...(sttLatencyMs !== undefined ? { sttLatencyMs } : {}),
        noSpeech: response.sttNoSpeech === true,
        outcomeReason: resolveVoiceOutcomeReason({
          durationMs,
          recognitionError: response.recognitionError,
          sttStatus: response.sttStatus,
          noSpeech: response.sttNoSpeech,
        }),
      });
    }
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
    if (activeDay === 1 && weekPlan) {
      const greeting = getLocalizedText(weekPlan.greeting, i18n.language);
      void playHaruDayOneNarration(normalizeLanguage(i18n.language), "day.1.greeting").then((played) => {
        if (!played) speakCalmly(greeting, getSpeechLanguage(i18n.language));
      });
    }
  }, [
    activeDay,
    completedResultPath,
    exercises,
    i18n.language,
    navigate,
    setCurrentIndex,
    setHasStarted,
    weekPlan,
  ]);

  useEffect(() => {
    if (!hasStarted || !currentExercise || !telemetryTracker) return;
    let cancelled = false;
    void (async () => {
      await telemetryTracker.startRoutine(
        activeDay ? `haru-week-day-${activeDay}` : "haru-routine",
        activeDay ?? 0,
        exercises.length,
      );
      if (existingSession?.status === "in_progress") {
        await telemetryTracker.resumeFromDropoff();
      }
      if (cancelled) return;
      const questionMeta = HARU_WEEK_QUESTION_META.find(
        (candidate) => candidate.exerciseId === currentExercise.id,
      );
      await telemetryTracker.presentQuestion({
        questionId: currentExercise.id,
        exerciseType: currentExercise.type,
        domain: currentExercise.payload.domain ?? "uncategorized",
        ordinal: currentIndex + 1,
        difficulty: String(currentExercise.difficulty),
        contentHash: hashTelemetryContent(
          currentExercise.id,
          currentExercise.type,
          marketConfig.contentPackVersion,
        ),
        ...(questionMeta?.responseType === "voice"
          ? { voiceExperience: HARU_VOICE_EXPERIENCE }
          : {}),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeDay,
    currentExercise,
    currentIndex,
    exercises.length,
    existingSession?.status,
    hasStarted,
    marketConfig.contentPackVersion,
    telemetryTracker,
  ]);

  useEffect(() => {
    if (!telemetryTracker) return;
    const onVisibility = () => {
      const visible = document.visibilityState !== "hidden";
      telemetryTracker.setVisible(visible);
      if (visible) {
        void telemetryTracker.resume();
      } else {
        void telemetryTracker.pause("background");
      }
    };
    const onFocus = () => {
      telemetryTracker.setFocused(true);
      if (document.visibilityState !== "hidden") {
        void telemetryTracker.resume();
      }
    };
    const onBlur = () => {
      telemetryTracker.setFocused(false);
      void telemetryTracker.pause("background");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" || event.key === "Shift" || event.key === "Control") {
        return;
      }
      telemetryInputModeRef.current = "key_action";
      void telemetryTracker.recordInteraction("key_action");
    };
    const onPageHide = () => {
      void telemetryTracker.exit("pagehide");
      void flushHaruTelemetry();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [telemetryTracker]);

  useEffect(() => {
    if (
      globalState !== "correct_feedback" &&
      globalState !== "incorrect_feedback" &&
      globalState !== "hint_feedback"
    ) {
      return;
    }
    const selectedIds = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-screen="lesson"] [data-choice-id][aria-pressed="true"]',
      ),
      (element) => element.dataset.choiceId,
    ).filter((id): id is string => Boolean(id));
    const isVoiceExercise =
      currentExercise?.type === "verbal_fluency_practice" ||
      currentExercise?.type === "speech_repeat_practice";
    void telemetryTracker?.confirmAnswer({
      inputMode: isVoiceExercise ? "voice" : telemetryInputModeRef.current,
      responseIds: selectedIds,
      result:
        globalState === "correct_feedback"
          ? "correct"
          : globalState === "incorrect_feedback"
            ? "incorrect"
            : "unscored",
    });
    void telemetryTracker?.showFeedback(
      globalState === "correct_feedback"
        ? "success"
        : globalState === "incorrect_feedback"
          ? "neutral"
          : "retry",
    );
  }, [currentExercise?.type, globalState, telemetryTracker]);

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
      void handleContinue();
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [
    finishSession,
    globalState,
    handleContinue,
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
              weekPlan && personalizedQuestionUse
                ? getLocalizedText(weekPlan.greeting, i18n.language)
                : t("lesson.start.mascotMessage")
            }
            mascotSrc="/assets/haru/buddy/wave_2.png"
            frameless
          />
        </div>
        {activeDay === 1 && personalizedQuestionUse && (
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

      <main
        className="flex flex-col flex-1 w-full max-w-md mx-auto px-4 mt-2"
        onPointerDownCapture={() => {
          telemetryInputModeRef.current = "touch";
          void telemetryTracker?.recordInteraction("touch");
        }}
        onClickCapture={handleTelemetryClick}
      >
        <ExerciseRenderer
          key={`${currentExercise.id}:${personalizedQuestionUse ? "personalized" : "generic"}`}
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
