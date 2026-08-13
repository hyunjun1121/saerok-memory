import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Mic2, Volume2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppFrame } from "@/components/AppFrame";
import { ChoiceCard, type ChoiceTone } from "@/components/ChoiceCard";
import type { GuideItem } from "@/components/PhysicalButtonGuide";
import { ProgressBar } from "@/components/ProgressBar";
import { HARU_WEEK_PLAN, type HaruWeekDay } from "@/data/haru7DayExercises";
import type { AnswerOption } from "@/data/mockExercises";
import { audioManager } from "@/features/audio";
import {
  createFourButtonState,
  fourButtonReducer,
  type ButtonSlot,
  type FourButtonState,
  type FourButtonIntent,
  useFourButtonHandler,
  useFourButtonStatus,
} from "@/features/input";
import {
  getOfflineQuestionsForDay,
  isChoiceAnswerCorrect,
  isSequenceAnswerCorrect,
  type OfflineQuestion,
} from "@/features/lesson/questionModel";
import {
  appendOfflineResponse,
  completeOfflineDay,
  loadOfflineProgress,
  removeOfflineResponse,
  restartOfflineDay,
  saveOfflineProgress,
  type OfflineProgress,
  type OfflineResponseRecord,
} from "@/features/lesson/progressStorage";
import { VoiceAmplitude } from "@/features/lesson/VoiceAmplitude";
import { getBuildLanguage, getUiCopy } from "@/i18n/copy";
import { getLocalizedText } from "@/utils/localizedText";

const slots = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const;
const badges = ["A", "B", "C", "D"] as const;
const tones: readonly ChoiceTone[] = ["red", "yellow", "green", "blue"];
const VOICE_TIMEOUT_REVIEW_GUARD_MS = 750;

type LessonStage = "intro" | "question" | "feedback";

interface FeedbackState {
  readonly exerciseId: string;
  readonly isCorrect: boolean | null;
  readonly body: string;
}

function isLeft(slot: ButtonSlot): boolean {
  return slot === "topLeft" || slot === "bottomLeft";
}

function parseDay(raw: string | null, fallback: HaruWeekDay): HaruWeekDay {
  const day = Number(raw);
  return Number.isInteger(day) && day >= 1 && day <= 7 ? day as HaruWeekDay : fallback;
}

function questionMode(question: OfflineQuestion): "choice" | "sequence" | "voice" {
  if (question.responseType === "button_sequence") return "sequence";
  if (question.responseType === "voice") return "voice";
  return "choice";
}

function questionItems(question: OfflineQuestion): readonly AnswerOption[] {
  return question.exercise.payload.options ?? question.exercise.payload.items ?? [];
}

function actionGuide(left: string, right: string): readonly [GuideItem, GuideItem, GuideItem, GuideItem] {
  return [
    { slot: "topLeft", badge: "A", tone: "red", label: left },
    { slot: "topRight", badge: "B", tone: "yellow", label: right },
    { slot: "bottomLeft", badge: "C", tone: "green", label: left },
    { slot: "bottomRight", badge: "D", tone: "blue", label: right },
  ];
}

function optionForSlot(question: OfflineQuestion, slot: ButtonSlot): AnswerOption | undefined {
  return questionItems(question)[slots.indexOf(slot)];
}

function createQuestionState(question: OfflineQuestion): FourButtonState {
  return createFourButtonState(questionMode(question));
}

function questionNarrationId(question: OfflineQuestion): string {
  return question.responseType === "button_sequence"
    ? `exercise.${question.exercise.id}.sequence`
    : `exercise.${question.exercise.id}.prompt`;
}

export function OfflineLessonScreen() {
  const [searchParams] = useSearchParams();
  const sessionKey = `${searchParams.get("day") ?? "default"}:${searchParams.get("restart") ?? "resume"}`;
  return <OfflineLessonSession key={sessionKey} />;
}

function OfflineLessonSession() {
  const language = getBuildLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeSlot } = useFourButtonStatus();
  const restartRequested = searchParams.get("restart") === "1";
  const [progress, setProgress] = useState<OfflineProgress>(() => {
    const loaded = loadOfflineProgress();
    if (!restartRequested) return loaded;
    const restartDay = parseDay(searchParams.get("day"), loaded.activeDay);
    const next = restartOfflineDay(
      loaded,
      restartDay,
      getOfflineQuestionsForDay(restartDay).map((question) => question.exercise.id),
    );
    saveOfflineProgress(next);
    return next;
  });
  const day = useMemo(
    () => parseDay(searchParams.get("day"), progress.activeDay),
    [progress.activeDay, searchParams],
  );
  const questions = useMemo(() => getOfflineQuestionsForDay(day), [day]);
  const firstUnansweredIndex = questions.findIndex((candidate) => (
    !progress.responses.some((response) => response.exerciseId === candidate.exercise.id)
  ));
  const [shouldRecoverCompletedDay] = useState(
    () => !restartRequested && questions.length > 0 && firstUnansweredIndex < 0,
  );
  const resumeIndex = restartRequested
    ? 0
    : firstUnansweredIndex >= 0
      ? firstUnansweredIndex
      : Math.max(0, questions.length - 1);
  const [questionIndex, setQuestionIndex] = useState(resumeIndex);
  const question = questions[questionIndex];
  const [stage, setStage] = useState<LessonStage>("intro");
  const [machine, setMachine] = useState<FourButtonState>(() => createQuestionState(questions[resumeIndex]));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [voiceTimeoutReviewGuarded, setVoiceTimeoutReviewGuarded] = useState(false);
  const questionStartedAt = useRef(0);

  const plan = HARU_WEEK_PLAN.find((entry) => entry.day === day) ?? HARU_WEEK_PLAN[0];

  const playNarration = useCallback((id: string) => {
    void audioManager.playNarration(id, language).then((result) => {
      if (result.status !== "played") setAudioUnavailable(true);
    });
  }, [language]);

  const beginQuestion = useCallback((index: number) => {
    const nextQuestion = questions[index];
    if (!nextQuestion) return;
    audioManager.stopNarration();
    setQuestionIndex(index);
    setMachine(createQuestionState(nextQuestion));
    setFeedback(null);
    setVoiceTimeoutReviewGuarded(false);
    setStage("question");
    questionStartedAt.current = performance.now();
    playNarration(questionNarrationId(nextQuestion));
  }, [playNarration, questions]);

  useEffect(() => {
    if (!shouldRecoverCompletedDay) return;
    saveOfflineProgress(completeOfflineDay(progress, day));
    navigate(`/result?day=${day}`, { replace: true });
  }, [day, navigate, progress, shouldRecoverCompletedDay]);

  useEffect(() => {
    if (shouldRecoverCompletedDay) return undefined;
    playNarration(`day.${day}.greeting`);
    return () => audioManager.stopNarration();
  }, [day, playNarration, shouldRecoverCompletedDay]);

  const persistResponse = useCallback((record: OfflineResponseRecord) => {
    setProgress((current) => {
      const next = appendOfflineResponse(current, record);
      saveOfflineProgress(next);
      return next;
    });
  }, []);

  const showFeedback = useCallback((isCorrect: boolean | null, selectedIds: string[]) => {
    const body = getLocalizedText(question.exercise.explanation, language) || getUiCopy(language, "responseSaved");
    persistResponse({
      exerciseId: question.exercise.id,
      kind: question.responseType,
      selectedIds,
      responseMs: Math.max(0, Math.round(performance.now() - questionStartedAt.current)),
      completedAt: new Date().toISOString(),
    });
    setFeedback({ exerciseId: question.exercise.id, isCorrect, body });
    setMachine(createFourButtonState("feedback"));
    setStage("feedback");
    void audioManager.playUi(isCorrect === false ? "retry" : "success");
    playNarration(isCorrect === false ? "feedback.try_again" : "feedback.saved");
  }, [language, persistResponse, playNarration, question]);

  const finishDay = useCallback(() => {
    const next = completeOfflineDay(progress, day);
    saveOfflineProgress(next);
    setProgress(next);
    navigate(`/result?day=${day}`);
  }, [day, navigate, progress]);

  const nextQuestion = useCallback(() => {
    if (questionIndex >= questions.length - 1) {
      finishDay();
      return;
    }
    beginQuestion(questionIndex + 1);
  }, [beginQuestion, finishDay, questionIndex, questions.length]);

  const retryQuestion = useCallback(() => {
    setProgress((current) => {
      const next = removeOfflineResponse(current, question.exercise.id);
      saveOfflineProgress(next);
      return next;
    });
    beginQuestion(questionIndex);
  }, [beginQuestion, question.exercise.id, questionIndex]);

  const handleIntent = useCallback((intent: FourButtonIntent | null) => {
    if (!intent) return;
    switch (intent.type) {
      case "choiceSelected": {
        void audioManager.playUi("select");
        const option = optionForSlot(question, intent.slot);
        if (option) playNarration(`exercise.${question.exercise.id}.option.${option.id}`);
        return;
      }
      case "choiceConfirmed": {
        void audioManager.playUi("confirm");
        const option = optionForSlot(question, intent.slot);
        if (option) showFeedback(isChoiceAnswerCorrect(question.exercise, option.id), [option.id]);
        return;
      }
      case "sequenceSelected": {
        void audioManager.playUi("select");
        const option = optionForSlot(question, intent.slot);
        if (option) playNarration(`exercise.${question.exercise.id}.option.${option.id}`);
        return;
      }
      case "sequenceStepConfirmed":
        void audioManager.playUi("confirm");
        return;
      case "sequenceReset":
        void audioManager.playUi("retry");
        playNarration(questionNarrationId(question));
        return;
      case "sequenceSubmitted": {
        void audioManager.playUi("confirm");
        const ids = intent.slots
          .map((slot) => optionForSlot(question, slot)?.id)
          .filter((id): id is string => Boolean(id));
        showFeedback(isSequenceAnswerCorrect(question.exercise, ids), ids);
        return;
      }
      case "voiceReplay":
        playNarration(`exercise.${question.exercise.id}.prompt`);
        return;
      case "voiceStarted":
      case "voiceRetried":
        audioManager.stopNarration();
        void audioManager.playUi("recordStart");
        return;
      case "voiceCancelled":
        void audioManager.playUi("recordStop");
        playNarration(`exercise.${question.exercise.id}.prompt`);
        return;
      case "voiceStopped":
        void audioManager.playUi("recordStop");
        playNarration("guide.voice_review");
        return;
      case "voiceSubmitted":
        showFeedback(null, []);
        return;
      case "feedbackRetryOrReplay":
        void audioManager.playUi("retry");
        retryQuestion();
        return;
      case "feedbackNext":
        void audioManager.playUi("confirm");
        nextQuestion();
        return;
    }
  }, [nextQuestion, playNarration, question, retryQuestion, showFeedback]);

  const pressQuestionButton = useCallback((slot: ButtonSlot) => {
    const next = fourButtonReducer(machine, { type: "press", slot });
    if (next === machine) return;
    setMachine(next);
    handleIntent(next.lastIntent);
  }, [handleIntent, machine]);

  const handleButton = useCallback((slot: ButtonSlot) => {
    if (voiceTimeoutReviewGuarded) return;
    if (stage === "intro") {
      if (isLeft(slot)) playNarration(`day.${day}.greeting`);
      else beginQuestion(questionIndex);
      return;
    }
    pressQuestionButton(slot);
  }, [beginQuestion, day, playNarration, pressQuestionButton, questionIndex, stage, voiceTimeoutReviewGuarded]);
  useFourButtonHandler(
    handleButton,
    !shouldRecoverCompletedDay && !voiceTimeoutReviewGuarded,
  );

  useEffect(() => {
    if (stage !== "question" || machine.kind !== "voice" || machine.stage !== "recording") return undefined;
    const durationSeconds = question.exercise.payload.durationSeconds ?? 30;
    const timer = window.setTimeout(() => {
      const next = fourButtonReducer(machine, { type: "press", slot: "topRight" });
      setVoiceTimeoutReviewGuarded(true);
      setMachine(next);
      handleIntent(next.lastIntent);
    }, durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [handleIntent, machine, question.exercise.payload.durationSeconds, stage]);

  useEffect(() => {
    if (!voiceTimeoutReviewGuarded) return undefined;
    const timer = window.setTimeout(
      () => setVoiceTimeoutReviewGuarded(false),
      VOICE_TIMEOUT_REVIEW_GUARD_MS,
    );
    return () => window.clearTimeout(timer);
  }, [voiceTimeoutReviewGuarded]);

  if (stage === "intro") {
    return (
      <AppFrame
        guideItems={actionGuide(getUiCopy(language, "replay"), getUiCopy(language, "start"))}
        activeSlot={activeSlot}
        dayLabel={getUiCopy(language, "day", { day })}
        reserveLessonBottomSpace
      >
        <section className="hero-card" data-screen="lesson-start">
          <img className="hero-card__mascot" src="/assets/haru/mascot.png" alt="" />
          <span className="question-copy__eyebrow">{getLocalizedText(plan.weekday, language)}</span>
          <h1>{getLocalizedText(plan.greeting, language)}</h1>
          <p>{getUiCopy(language, "startDuration")}</p>
          <p>{getUiCopy(language, "startHint")}</p>
          {audioUnavailable ? <p className="audio-warning">{getUiCopy(language, "audioUnavailable")}</p> : null}
        </section>
      </AppFrame>
    );
  }

  if (stage === "feedback" && feedback) {
    const title = feedback.isCorrect === true
      ? getUiCopy(language, "answerMatched")
      : feedback.isCorrect === false
        ? getUiCopy(language, "answerDifferent")
        : getUiCopy(language, "responseSaved");
    return (
      <AppFrame
        guideItems={actionGuide(getUiCopy(language, "retry"), getUiCopy(language, "next"))}
        activeSlot={activeSlot}
        dayLabel={getUiCopy(language, "day", { day })}
        reserveLessonBottomSpace
      >
        <ProgressBar
          value={questionIndex + 1}
          max={questions.length}
          label={getUiCopy(language, "questionProgress", { current: questionIndex + 1, total: questions.length })}
        />
        <section
          className={`feedback-card ${feedback.isCorrect === false ? "feedback-card--neutral" : "feedback-card--success"}`}
          data-screen="lesson-feedback"
          data-exercise-id={feedback.exerciseId}
          data-testid={`feedback-${feedback.exerciseId}`}
        >
          <CheckCircle2 className="feedback-card__icon" aria-hidden="true" />
          <h1>{title}</h1>
          <p>{feedback.body}</p>
          <p>{getUiCopy(language, "feedbackHint")}</p>
        </section>
      </AppFrame>
    );
  }

  if (machine.kind === "feedback") return null;

  const items = questionItems(question);
  const choiceGuide = slots.map((slot, index) => ({
    slot,
    badge: badges[index],
    tone: tones[index],
    label: machine.kind === "choice" && machine.selectedSlot === slot
      ? getUiCopy(language, "sameButton")
      : getUiCopy(language, "directChoice"),
  })) as [GuideItem, GuideItem, GuideItem, GuideItem];

  let guide: readonly [GuideItem, GuideItem, GuideItem, GuideItem] = choiceGuide;
  if (machine.kind === "sequence") {
    guide = machine.phase === "review"
      ? actionGuide(getUiCopy(language, "resetSequence"), getUiCopy(language, "submitSequence"))
      : slots.map((slot, index) => ({
          slot,
          badge: badges[index],
          tone: tones[index],
          label: machine.confirmedSlots.includes(slot)
            ? getUiCopy(language, "sequenceUsed")
            : machine.pendingSlot === slot
              ? getUiCopy(language, "sameButton")
              : getUiCopy(language, "directChoice"),
        })) as [GuideItem, GuideItem, GuideItem, GuideItem];
  } else if (machine.kind === "voice") {
    if (machine.stage === "ready") guide = actionGuide(getUiCopy(language, "replay"), getUiCopy(language, "recordStart"));
    else if (machine.stage === "recording") guide = actionGuide(getUiCopy(language, "cancel"), getUiCopy(language, "recordStop"));
    else guide = actionGuide(getUiCopy(language, "retry"), getUiCopy(language, "confirm"));
  }

  const instruction = machine.kind === "choice"
    ? machine.selectedSlot ? getUiCopy(language, "selectedHint") : getUiCopy(language, "selectHint")
    : machine.kind === "sequence"
      ? machine.phase === "review"
        ? getUiCopy(language, "sequenceReview")
        : getUiCopy(language, "sequenceStep", { current: machine.confirmedSlots.length + 1 })
      : machine.stage === "ready"
        ? getUiCopy(language, "voiceReadyBody")
        : machine.stage === "recording"
          ? getUiCopy(language, "voiceRecordingBody")
          : getUiCopy(language, "voiceReviewBody");

  return (
    <AppFrame
      guideItems={guide}
      activeSlot={activeSlot}
      dayLabel={getUiCopy(language, "day", { day })}
      reserveLessonBottomSpace
    >
      <ProgressBar
        value={questionIndex + 1}
        max={questions.length}
        label={getUiCopy(language, "questionProgress", { current: questionIndex + 1, total: questions.length })}
      />
      <section
        className="question-layout"
        data-screen="lesson-question"
        data-exercise-id={question.exercise.id}
        data-question-kind={question.responseType}
        data-testid={`question-${question.exercise.id}`}
      >
        <div className="question-copy">
          <span className="question-copy__eyebrow">{getUiCopy(language, "questionProgress", { current: questionIndex + 1, total: questions.length })}</span>
          <h1>{getLocalizedText(question.exercise.prompt, language)}</h1>
          <p>{instruction}</p>
          {audioUnavailable ? <p className="audio-warning">{getUiCopy(language, "audioUnavailable")}</p> : null}
        </div>
        {machine.kind === "voice" ? (
          <div className="voice-card" data-voice-stage={machine.stage}>
            {machine.stage === "recording" ? <Mic2 aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            <h1>{machine.stage === "ready"
              ? getUiCopy(language, "voiceReady")
              : machine.stage === "recording"
                ? getUiCopy(language, "voiceRecording")
                : getUiCopy(language, "voiceReview")}</h1>
            <VoiceAmplitude active={machine.stage === "recording"} fallbackLabel={getUiCopy(language, "voiceFallback")} />
          </div>
        ) : (
          <div className="choice-grid">
            {items.map((item, index) => {
              const slot = slots[index];
              const sequenceOrder = machine.kind === "sequence"
                ? machine.confirmedSlots.indexOf(slot) + 1
                : 0;
              return (
                <ChoiceCard
                  key={item.id}
                  slot={slot}
                  badge={badges[index]}
                  tone={tones[index]}
                  label={getLocalizedText(item.label, language)}
                  selected={machine.kind === "choice" ? machine.selectedSlot === slot : machine.pendingSlot === slot}
                  confirmed={machine.kind === "sequence" && machine.confirmedSlots.includes(slot)}
                  disabled={machine.kind === "sequence" && machine.confirmedSlots.includes(slot)}
                  order={sequenceOrder || undefined}
                />
              );
            })}
          </div>
        )}
      </section>
    </AppFrame>
  );
}

export function OfflineResultScreen() {
  const language = getBuildLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeSlot } = useFourButtonStatus();
  const progress = loadOfflineProgress();
  const day = parseDay(searchParams.get("day"), progress.activeDay);
  const plan = HARU_WEEK_PLAN.find((entry) => entry.day === day) ?? HARU_WEEK_PLAN[0];
  const playCompletion = useCallback(() => {
    void audioManager.playUi("routineComplete");
    void audioManager.playNarration(`day.${day}.completion`, language);
  }, [day, language]);

  useEffect(() => {
    playCompletion();
    return () => audioManager.stopNarration();
  }, [playCompletion]);

  const handleButton = useCallback((slot: ButtonSlot) => {
    if (isLeft(slot)) playCompletion();
    else navigate("/kiosk");
  }, [navigate, playCompletion]);
  useFourButtonHandler(handleButton);

  return (
    <AppFrame
      guideItems={actionGuide(getUiCopy(language, "replay"), getUiCopy(language, "returnMenu"))}
      activeSlot={activeSlot}
      dayLabel={getUiCopy(language, "day", { day })}
    >
      <section className="hero-card" data-screen="result">
        <img className="hero-card__mascot" src="/assets/haru/mascot.png" alt="" />
        <CheckCircle2 className="feedback-card__icon" aria-hidden="true" />
        <h1>{getUiCopy(language, "completedTitle")}</h1>
        <p>{getLocalizedText(plan.completionMessage, language)}</p>
      </section>
    </AppFrame>
  );
}
