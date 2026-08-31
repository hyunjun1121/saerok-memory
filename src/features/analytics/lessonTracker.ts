import {
  createActiveClock,
  readActiveClock,
  reduceActiveClock,
  type ActiveClockState,
} from "@/features/analytics/activeClock";
import type {
  TelemetryCaptureContext,
} from "@/features/analytics/runtime";
import type {
  TelemetryEventName,
  TelemetryInputMode,
  TelemetryPayloadMap,
  TelemetryVoiceExperienceVariant,
  TelemetryWaveformMode,
} from "@/features/analytics/types";
import type {
  HaruActivitySessionInput,
  HaruQuestionAttemptInput,
} from "@/features/profile/haruDataApi";

export interface HaruQuestionTelemetryMeta {
  questionId: string;
  exerciseType: string;
  domain: string;
  ordinal: number;
  difficulty: string;
  contentHash: string;
  voiceExperience?: {
    voiceExperienceVariant: TelemetryVoiceExperienceVariant;
    waveformMode: TelemetryWaveformMode;
    guidanceCopyVersion: string;
    sttPipelineVersion?: string;
  };
}

export interface ConfirmedAnswerTelemetry {
  inputMode: TelemetryInputMode;
  responseIds: string[];
  result: "correct" | "incorrect" | "unscored";
}

type CaptureTelemetry = <Name extends TelemetryEventName>(
  eventName: Name,
  payload: TelemetryPayloadMap[Name],
  context?: TelemetryCaptureContext,
) => Promise<boolean>;

export interface HaruLessonTelemetryTrackerOptions {
  nowMs: () => number;
  createRoutineSessionId: () => string;
  createQuestionInstanceId: () => string;
  capture: CaptureTelemetry;
  submitSession: (input: HaruActivitySessionInput) => Promise<boolean>;
  submitAttempt: (input: HaruQuestionAttemptInput) => Promise<boolean>;
  contentPackVersion: string;
  consentRevision: () => string;
  canStoreActivity: () => boolean;
}

interface CurrentQuestion {
  meta: HaruQuestionTelemetryMeta;
  instanceId: string;
  presentedAtMs: number;
  clock: ActiveClockState;
  firstInteractionAtMs?: number;
  confirmedAtMs?: number;
  confirmation?: ConfirmedAnswerTelemetry;
  selectionChangeCount: number;
  attemptCount: number;
  hintCount: number;
}

function atIso(atMs: number): string {
  return new Date(Math.max(0, atMs)).toISOString();
}

export class HaruLessonTelemetryTracker {
  private readonly options: HaruLessonTelemetryTrackerOptions;
  private routineSessionId?: string;
  private routineClock?: ActiveClockState;
  private currentQuestion?: CurrentQuestion;
  private totalQuestions = 0;
  private completedQuestions = 0;
  private paused = false;
  private dropoffResumeRecorded = false;
  private routineCompleted = false;
  private exitObserved = false;

  constructor(options: HaruLessonTelemetryTrackerOptions) {
    this.options = options;
  }

  getSessionId(): string | undefined {
    return this.routineSessionId;
  }

  getQuestionInstanceId(): string | undefined {
    return this.currentQuestion?.instanceId;
  }

  private context(): TelemetryCaptureContext {
    return {
      ...(this.routineSessionId ? { routineSessionId: this.routineSessionId } : {}),
      ...(this.currentQuestion
        ? { questionInstanceId: this.currentQuestion.instanceId }
        : {}),
    };
  }

  private async submitSession(state: HaruActivitySessionInput["state"]): Promise<void> {
    if (
      !this.options.canStoreActivity() ||
      !this.routineSessionId ||
      !this.routineClock
    ) {
      return;
    }
    const nowMs = this.options.nowMs();
    const timing = readActiveClock(this.routineClock, nowMs);
    await this.options.submitSession({
      sessionId: this.routineSessionId,
      state,
      occurredAt: atIso(nowMs),
      contentPackVersion: this.options.contentPackVersion,
      consentRevision: this.options.consentRevision(),
      progressPercent:
        this.totalQuestions > 0
          ? Math.min(100, Math.round((this.completedQuestions / this.totalQuestions) * 100))
          : 0,
      activeDurationMs: Math.round(timing.activeDurationMs),
      wallDurationMs: Math.round(timing.wallDurationMs),
      ...(this.currentQuestion
        ? { lastQuestionInstanceId: this.currentQuestion.instanceId }
        : {}),
    });
  }

  async startRoutine(routineId: string, dayIndex: number, totalQuestions: number): Promise<void> {
    if (this.routineSessionId) return;
    const nowMs = this.options.nowMs();
    this.routineSessionId = this.options.createRoutineSessionId();
    this.routineClock = createActiveClock(nowMs);
    this.totalQuestions = Math.max(0, Math.trunc(totalQuestions));
    this.paused = false;
    this.dropoffResumeRecorded = false;
    this.routineCompleted = false;
    this.exitObserved = false;
    await this.options.capture(
      "routine_started",
      { routineId, dayIndex: Math.max(0, Math.trunc(dayIndex)) },
      this.context(),
    );
    await this.submitSession("started");
  }

  async resumeFromDropoff(): Promise<void> {
    if (
      !this.routineSessionId ||
      this.routineCompleted ||
      this.dropoffResumeRecorded
    ) {
      return;
    }
    this.dropoffResumeRecorded = true;
    await this.options.capture(
      "routine_resumed",
      { resumeKind: "after_dropoff" },
      this.context(),
    );
    await this.submitSession("resumed");
  }

  async pause(reason: "user" | "background" | "idle"): Promise<void> {
    if (!this.routineSessionId || this.routineCompleted || this.paused) return;
    this.paused = true;
    await this.options.capture("routine_paused", { reason }, this.context());
    await this.submitSession("paused");
  }

  async resume(): Promise<void> {
    if (!this.routineSessionId || this.routineCompleted || !this.paused) return;
    this.paused = false;
    await this.options.capture(
      "routine_resumed",
      { resumeKind: "same_session" },
      this.context(),
    );
    await this.submitSession("resumed");
  }

  async presentQuestion(meta: HaruQuestionTelemetryMeta): Promise<void> {
    if (!this.routineSessionId) return;
    const nowMs = this.options.nowMs();
    this.currentQuestion = {
      meta,
      instanceId: this.options.createQuestionInstanceId(),
      presentedAtMs: nowMs,
      clock: createActiveClock(nowMs),
      selectionChangeCount: 0,
      attemptCount: 1,
      hintCount: 0,
    };
    await this.options.capture(
      "question_presented",
      {
        questionId: meta.questionId,
        exerciseType: meta.exerciseType,
        domain: meta.domain,
        ordinal: Math.max(0, Math.trunc(meta.ordinal)),
        difficulty: meta.difficulty,
        questionContentVersion: this.options.contentPackVersion,
        questionContentHash: meta.contentHash,
        ...(meta.voiceExperience ?? {}),
      },
      this.context(),
    );
  }

  async recordInteraction(inputMode: TelemetryInputMode): Promise<void> {
    const question = this.currentQuestion;
    if (!question) return;
    const nowMs = this.options.nowMs();
    this.touch(nowMs);
    if (question.firstInteractionAtMs !== undefined) return;
    question.firstInteractionAtMs = nowMs;
    await this.options.capture(
      "question_first_interaction",
      { inputMode, latencyMs: Math.max(0, Math.round(nowMs - question.presentedAtMs)) },
      this.context(),
    );
  }

  async recordChoice(actionId: string, selected: boolean, selectionCount: number): Promise<void> {
    const question = this.currentQuestion;
    if (!question) return;
    question.selectionChangeCount += 1;
    await this.options.capture(
      "choice_changed",
      {
        actionId,
        selectionState: selected ? "selected" : "deselected",
        selectionCount: Math.max(0, Math.trunc(selectionCount)),
        changeIndex: question.selectionChangeCount,
      },
      this.context(),
    );
  }

  async recordVoiceCaptureStatus(
    payload: TelemetryPayloadMap["voice_capture_status"],
  ): Promise<void> {
    if (!this.currentQuestion) return;
    await this.options.capture("voice_capture_status", payload, this.context());
  }

  async confirmAnswer(answer: ConfirmedAnswerTelemetry): Promise<void> {
    const question = this.currentQuestion;
    if (!question || question.confirmedAtMs !== undefined) return;
    const nowMs = this.options.nowMs();
    this.touch(nowMs);
    question.confirmedAtMs = nowMs;
    question.confirmation = {
      ...answer,
      responseIds: [...answer.responseIds],
    };
    const timing = readActiveClock(question.clock, nowMs);
    await this.options.capture(
      "answer_confirmed",
      {
        inputMode: answer.inputMode,
        responseIds: [...answer.responseIds],
        result: answer.result,
        responseTimeMs: Math.max(0, Math.round(nowMs - question.presentedAtMs)),
        activeResponseTimeMs: Math.round(timing.activeDurationMs),
        selectionChangeCount: question.selectionChangeCount,
      },
      this.context(),
    );
  }

  async showFeedback(kind: "success" | "retry" | "neutral"): Promise<void> {
    if (!this.currentQuestion) return;
    await this.options.capture("feedback_shown", { kind }, this.context());
  }

  async useHint(hintId: string): Promise<void> {
    const question = this.currentQuestion;
    if (!question) return;
    question.hintCount += 1;
    await this.options.capture(
      "hint_used",
      { hintId, attempt: question.attemptCount },
      this.context(),
    );
  }

  async retry(): Promise<void> {
    const question = this.currentQuestion;
    if (!question) return;
    question.attemptCount += 1;
    await this.options.capture(
      "retry_started",
      { attempt: question.attemptCount },
      this.context(),
    );
  }

  async completeQuestion(): Promise<void> {
    const question = this.currentQuestion;
    if (!question) return;
    const nowMs = this.options.nowMs();
    question.clock = reduceActiveClock(question.clock, { type: "stop", atMs: nowMs });
    const timing = readActiveClock(question.clock, nowMs);
    const questionContext: TelemetryCaptureContext = {
      ...(this.routineSessionId ? { routineSessionId: this.routineSessionId } : {}),
      questionInstanceId: question.instanceId,
    };
    // Release current slot before asynchronous persistence. Fast UI advance
    // can safely present next question while previous write finishes.
    this.currentQuestion = undefined;
    this.completedQuestions += 1;
    await this.options.capture(
      "question_completed",
      {
        attemptCount: question.attemptCount,
        activeDurationMs: Math.round(timing.activeDurationMs),
        wallDurationMs: Math.round(timing.wallDurationMs),
        feedbackDurationMs:
          question.confirmedAtMs === undefined
            ? 0
            : Math.max(0, Math.round(nowMs - question.confirmedAtMs)),
      },
      questionContext,
    );

    if (this.options.canStoreActivity() && this.routineSessionId) {
      const confirmation = question.confirmation;
      await this.options.submitAttempt({
        sessionId: this.routineSessionId,
        questionInstanceId: question.instanceId,
        questionId: question.meta.questionId,
        questionType: question.meta.exerciseType,
        contentPackVersion: this.options.contentPackVersion,
        presentedAt: atIso(question.presentedAtMs),
        completedAt: atIso(nowMs),
        activeDurationMs: Math.round(timing.activeDurationMs),
        wallDurationMs: Math.round(timing.wallDurationMs),
        ...(question.firstInteractionAtMs !== undefined
          ? {
              firstInteractionMs: Math.max(
                0,
                Math.round(question.firstInteractionAtMs - question.presentedAtMs),
              ),
            }
          : {}),
        ...(question.confirmedAtMs !== undefined &&
        question.firstInteractionAtMs !== undefined
          ? {
              confirmationLatencyMs: Math.max(
                0,
                Math.round(question.confirmedAtMs - question.firstInteractionAtMs),
              ),
            }
          : {}),
        response: {
          ...(confirmation?.responseIds.length
            ? { selectedOptionIds: [...confirmation.responseIds] }
            : {}),
          ...(confirmation?.result === "correct" ? { isCorrect: true } : {}),
          ...(confirmation?.result === "incorrect" ? { isCorrect: false } : {}),
          isValid: Boolean(confirmation),
          retryCount: Math.max(0, question.attemptCount - 1),
          hintCount: question.hintCount,
        },
      });
    }
  }

  async completeRoutine(): Promise<void> {
    if (
      !this.routineSessionId ||
      !this.routineClock ||
      this.routineCompleted
    ) {
      return;
    }
    this.routineCompleted = true;
    this.paused = false;
    const nowMs = this.options.nowMs();
    this.routineClock = reduceActiveClock(this.routineClock, { type: "stop", atMs: nowMs });
    const timing = readActiveClock(this.routineClock, nowMs);
    await this.options.capture(
      "routine_completed",
      {
        questionCount: this.completedQuestions,
        activeDurationMs: Math.round(timing.activeDurationMs),
        wallDurationMs: Math.round(timing.wallDurationMs),
      },
      this.context(),
    );
    await this.submitSession("completed");
  }

  async exit(
    reason: "pagehide" | "reload" | "close" | "route_change" | "unknown" | "user",
  ): Promise<void> {
    if (!this.routineSessionId || this.routineCompleted || this.exitObserved) return;
    this.exitObserved = true;
    const telemetryReason = reason === "user" ? "route_change" : reason;
    await this.options.capture(
      "session_exit_observed",
      { reason: telemetryReason },
      this.context(),
    );
    await this.submitSession("exit_observed");
  }

  touch(atMs = this.options.nowMs()): void {
    if (this.routineClock) {
      this.routineClock = reduceActiveClock(this.routineClock, {
        type: "interaction",
        atMs,
      });
    }
    if (this.currentQuestion) {
      this.currentQuestion.clock = reduceActiveClock(this.currentQuestion.clock, {
        type: "interaction",
        atMs,
      });
    }
  }

  setVisible(visible: boolean): void {
    const atMs = this.options.nowMs();
    if (this.routineClock) {
      this.routineClock = reduceActiveClock(this.routineClock, {
        type: "visibility",
        visible,
        atMs,
      });
    }
    if (this.currentQuestion) {
      this.currentQuestion.clock = reduceActiveClock(this.currentQuestion.clock, {
        type: "visibility",
        visible,
        atMs,
      });
    }
  }

  setFocused(focused: boolean): void {
    const atMs = this.options.nowMs();
    if (this.routineClock) {
      this.routineClock = reduceActiveClock(this.routineClock, {
        type: "focus",
        focused,
        atMs,
      });
    }
    if (this.currentQuestion) {
      this.currentQuestion.clock = reduceActiveClock(this.currentQuestion.clock, {
        type: "focus",
        focused,
        atMs,
      });
    }
  }
}
