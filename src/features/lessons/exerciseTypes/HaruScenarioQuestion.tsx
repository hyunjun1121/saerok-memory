import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import {
  ChoiceCard,
  type ChoiceCardState,
  type ChoiceCardTone,
} from "@/components/ChoiceCard";
import type {
  HaruQuestionResponseType,
  HaruWeekQuestionMeta,
} from "@/data/haru7DayExercises";
import type { Exercise } from "@/data/mockExercises";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import {
  HARU_CHOICE_KEY_BINDINGS,
  type HaruChoiceKeyBindings,
} from "@/features/lessons/haruInputBindings";
import { useHaruChoiceKeys } from "@/features/lessons/useHaruChoiceKeys";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import type { TranscribeSegment } from "@/features/speech/stt";
import { useVoiceRecorder } from "@/features/speech/useVoiceRecorder";
import { VoiceWaveform } from "@/features/speech/VoiceWaveform";
import {
  getHaruConsent,
  subscribeToHaruConsent,
} from "@/features/profile/haruConsentStorage";
import {
  getHaruVoiceConsentError,
  hasHaruVoicePipelineConsent,
  useHaruConsent,
} from "@/features/profile/useHaruConsent";
import { speakCalmly } from "@/hooks/interactionFeedback";
import { getLocalizedText, getSpeechLanguage } from "@/utils/localizedText";

export interface HaruScenarioLiveResponse {
  questionId: string;
  responseType: HaruQuestionResponseType;
  selectedOptionId?: string;
  submittedSequence?: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  voiceDurationSeconds?: number;
  sttStatus?: "completed" | "failed";
  sttNoSpeech?: boolean;
  sttLanguage?: string;
  sttConfidence?: number;
  recognitionError?: string | null;
  derivedAnnotations?: HaruDerivedAnnotation[];
  feedback: string;
}

export interface HaruScenarioAdminResponse extends HaruScenarioLiveResponse {
  respondedAt: string;
  inputMode?: "physical_button" | "touch";
  buttonPressedAt?: string;
  sequenceButtonEvents?: Array<{
    optionId: string;
    pressedAt: string;
    elapsedMsFromQuestion: number;
    inputMode: "physical_button" | "touch";
  }>;
  recordingStartedAt?: string;
  recordingEndedAt?: string;
  audioBlob?: Blob;
  audioSampleRateHz?: number;
  audioChannelCount?: number;
  sttProcessedAt?: string;
  sttEngine?: string;
  sttModel?: string;
  sttModelRevision?: string;
  sttAlignerModel?: string;
  sttAlignerRevision?: string;
  sttPreprocessingVersion?: string;
  sttSegments?: TranscribeSegment[];
  rawUserUtteranceTranscript?: string;
}

type HaruScenarioAdminDetails = Omit<
  HaruScenarioAdminResponse,
  keyof HaruScenarioLiveResponse | "respondedAt"
>;

interface HaruScenarioQuestionProps {
  exercise: Exercise;
  question: HaruWeekQuestionMeta;
  globalState: ExerciseState;
  setGlobalState: (state: ExerciseState) => void;
  onResponse: (response: HaruScenarioLiveResponse) => void;
  onAdminResponse?: (response: HaruScenarioAdminResponse) => void;
  choiceKeyBindings?: HaruChoiceKeyBindings;
  useRecordedFeedback?: boolean;
}

function arraysMatch(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isFeedbackState(state: ExerciseState): boolean {
  return (
    state === "correct_feedback" ||
    state === "incorrect_feedback" ||
    state === "hint_feedback"
  );
}

const HARU_CHOICE_TONE_BY_ID: Readonly<Partial<Record<string, ChoiceCardTone>>> = {
  A: "red",
  B: "yellow",
  C: "green",
  D: "blue",
};

function getHaruChoiceTone(id: string): ChoiceCardTone {
  return HARU_CHOICE_TONE_BY_ID[id] ?? "neutral";
}

export function HaruScenarioQuestion({
  exercise,
  question,
  globalState,
  setGlobalState,
  onResponse,
  onAdminResponse,
  choiceKeyBindings,
  useRecordedFeedback = true,
}: HaruScenarioQuestionProps) {
  return (
    <HaruScenarioQuestionContent
      key={exercise.id}
      exercise={exercise}
      question={question}
      globalState={globalState}
      setGlobalState={setGlobalState}
      onResponse={onResponse}
      onAdminResponse={onAdminResponse}
      choiceKeyBindings={choiceKeyBindings}
      useRecordedFeedback={useRecordedFeedback}
    />
  );
}

function HaruScenarioQuestionContent({
  exercise,
  question,
  globalState,
  setGlobalState,
  onResponse,
  onAdminResponse,
  choiceKeyBindings = HARU_CHOICE_KEY_BINDINGS,
  useRecordedFeedback = true,
}: HaruScenarioQuestionProps) {
  const { t, i18n } = useTranslation();
  const maxDurationSeconds =
    question.maxResponseSeconds ?? exercise.payload.durationSeconds ?? 60;
  const recorder = useVoiceRecorder(maxDurationSeconds * 1000);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<string[]>([]);
  const [hasResponded, setHasResponded] = useState(false);
  const [responseCorrectness, setResponseCorrectness] = useState<boolean | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const selectedButtonEventRef = useRef<{
    optionId: string;
    pressedAt: string;
    inputMode: "physical_button" | "touch";
  } | null>(null);
  const sequenceButtonEventsRef = useRef<
    HaruScenarioAdminResponse["sequenceButtonEvents"]
  >([]);
  const nextInputModeRef = useRef<"physical_button" | "touch">("touch");
  const respondedRef = useRef(false);
  const choiceGridRef = useRef<HTMLDivElement>(null);

  const prompt = getLocalizedText(exercise.prompt, i18n.language);
  const promptAudio = getLocalizedText(
    exercise.payload.audioText ?? exercise.prompt,
    i18n.language,
  );
  const authoredExplanation = getLocalizedText(exercise.explanation, i18n.language);
  const recordedFeedback = getLocalizedText(
    question.recordedResponse.feedback,
    i18n.language,
  );
  const options = exercise.payload.options ?? [];
  const items = exercise.payload.items ?? [];
  const correctSequence = Array.isArray(exercise.correctAnswer)
    ? exercise.correctAnswer
    : [];
  const requiredSelectionCount = Math.min(
    Math.max(exercise.payload.requiredSelectionCount ?? items.length, 1),
    items.length,
  );
  const consent = useHaruConsent();
  const speechConsentGranted = hasHaruVoicePipelineConsent(consent);
  const captureAuthorizedRef = useRef(speechConsentGranted);
  const consentRevisionRef = useRef(0);
  const recordingConsentRevisionRef = useRef<number | null>(
    speechConsentGranted ? 0 : null,
  );
  const pipelineConsentGrantedRef = useRef(speechConsentGranted);
  const recorderIsSupported = recorder.isSupported;
  const startRecording = recorder.start;
  const stopRecording = recorder.stop;

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    return subscribeToHaruConsent((nextConsent) => {
      const nextGranted = hasHaruVoicePipelineConsent(nextConsent);
      if (pipelineConsentGrantedRef.current && !nextGranted) {
        captureAuthorizedRef.current = false;
        consentRevisionRef.current += 1;
        recordingConsentRevisionRef.current = null;
        stopRecording();
      }
      pipelineConsentGrantedRef.current = nextGranted;
    });
  }, [stopRecording]);

  useEffect(() => {
    if (
      question.responseType === "voice" &&
      speechConsentGranted &&
      recorderIsSupported &&
      hasHaruVoicePipelineConsent(getHaruConsent())
    ) {
      captureAuthorizedRef.current = true;
      recordingConsentRevisionRef.current = consentRevisionRef.current;
      startRecording();
    }
  }, [question.responseType, recorderIsSupported, speechConsentGranted, startRecording]);

  const responseTimeMs = () =>
    startedAtRef.current === null
      ? 0
      : Math.max(0, Date.now() - startedAtRef.current);

  const feedbackFor = (isCorrect: boolean | null, matchesRecorded: boolean): string => {
    if (useRecordedFeedback && matchesRecorded && recordedFeedback) return recordedFeedback;
    if (isCorrect === false) return t("feedback.incorrect.moveOn");
    return authoredExplanation || recordedFeedback || t("feedback.continue");
  };

  const finishResponse = (
    response: HaruScenarioLiveResponse,
    adminDetails: HaruScenarioAdminDetails = {},
  ) => {
    onResponse(response);
    onAdminResponse?.({
      ...response,
      ...adminDetails,
      respondedAt: new Date().toISOString(),
    });
    setHasResponded(true);
    setResponseCorrectness(response.isCorrect);
    setGlobalState(response.isCorrect === false ? "incorrect_feedback" : "correct_feedback");
  };

  const handleReplay = () => {
    const sequenceLabels = correctSequence
      .map((id) => items.find((item) => item.id === id))
      .map((item) => getLocalizedText(item?.label, i18n.language))
      .filter(Boolean);
    const text =
      question.responseType === "button_sequence" && sequenceLabels.length > 0
        ? sequenceLabels.join(", ")
        : promptAudio;
    speakCalmly(text, getSpeechLanguage(i18n.language));
  };

  const handleSingleChoice = (id: string) => {
    if (respondedRef.current || isFeedbackState(globalState)) return;
    selectedButtonEventRef.current = {
      optionId: id,
      pressedAt: new Date().toISOString(),
      inputMode: nextInputModeRef.current,
    };
    nextInputModeRef.current = "touch";
    setSelectedOptionId(id);
    setGlobalState("answer_selected");
  };

  const handleSingleSubmit = () => {
    if (
      respondedRef.current ||
      isFeedbackState(globalState) ||
      selectedOptionId === null
    ) {
      return;
    }
    respondedRef.current = true;
    const isCorrect =
      typeof exercise.correctAnswer === "string"
        ? selectedOptionId === exercise.correctAnswer
        : null;
    const matchesRecorded =
      question.recordedResponse.selectedOptionId === selectedOptionId;
    const buttonEvent = selectedButtonEventRef.current;
    finishResponse(
      {
        questionId: question.exerciseId,
        responseType: "single_choice",
        selectedOptionId,
        responseTimeMs: responseTimeMs(),
        isCorrect,
        feedback: feedbackFor(isCorrect, matchesRecorded),
      },
      {
        inputMode: buttonEvent?.inputMode ?? "touch",
        ...(buttonEvent ? { buttonPressedAt: buttonEvent.pressedAt } : {}),
      },
    );
  };

  const handleSequenceChoice = (id: string) => {
    if (respondedRef.current || isFeedbackState(globalState)) return;
    const inputMode = nextInputModeRef.current;
    nextInputModeRef.current = "touch";
    const isRemoving = selectedSequence.includes(id);
    const nextSequence = isRemoving
      ? selectedSequence.filter((selectedId) => selectedId !== id)
      : selectedSequence.length >= requiredSelectionCount
        ? selectedSequence
        : [...selectedSequence, id];

    if (nextSequence === selectedSequence) return;
    if (isRemoving) {
      sequenceButtonEventsRef.current = sequenceButtonEventsRef.current?.filter(
        (event) => event.optionId !== id,
      );
    } else {
      sequenceButtonEventsRef.current = [
        ...(sequenceButtonEventsRef.current ?? []),
        {
          optionId: id,
          pressedAt: new Date().toISOString(),
          elapsedMsFromQuestion: responseTimeMs(),
          inputMode,
        },
      ];
    }
    setSelectedSequence(nextSequence);
    setGlobalState(nextSequence.length > 0 ? "answer_selected" : "awaiting_answer");
  };

  const handleSequenceSubmit = () => {
    if (
      respondedRef.current ||
      isFeedbackState(globalState) ||
      selectedSequence.length !== requiredSelectionCount
    ) {
      return;
    }
    respondedRef.current = true;

    const isCorrect = arraysMatch(selectedSequence, correctSequence);
    const matchesRecorded = arraysMatch(
      selectedSequence,
      question.recordedResponse.submittedSequence ?? [],
    );
    finishResponse(
      {
        questionId: question.exerciseId,
        responseType: "button_sequence",
        submittedSequence: [...selectedSequence],
        responseTimeMs: responseTimeMs(),
        isCorrect,
        feedback: feedbackFor(isCorrect, matchesRecorded),
      },
      {
        sequenceButtonEvents: [...(sequenceButtonEventsRef.current ?? [])],
      },
    );
  };

  const selectChoiceByIndex = useCallback((index: number) => {
    const choiceButton =
      choiceGridRef.current?.querySelectorAll<HTMLButtonElement>("button")[index];
    if (!choiceButton) return;
    nextInputModeRef.current = "physical_button";
    choiceButton.focus();
    choiceButton.click();
  }, []);

  const isChoiceQuestion =
    question.responseType === "single_choice" ||
    question.responseType === "button_sequence";
  const canSubmitChoice =
    !hasResponded &&
    !isFeedbackState(globalState) &&
    (question.responseType === "single_choice"
      ? selectedOptionId !== null
      : question.responseType === "button_sequence"
        ? selectedSequence.length === requiredSelectionCount
        : false);

  useHaruChoiceKeys({
    bindings: choiceKeyBindings,
    enabled: isChoiceQuestion && !hasResponded && !isFeedbackState(globalState),
    onSelect: selectChoiceByIndex,
  });

  const handleVoiceFinish = async () => {
    if (respondedRef.current || isFeedbackState(globalState)) return;
    respondedRef.current = true;
    setIsTranscribing(true);

    const consentAtFinish = getHaruConsent();
    const recordingConsentRevision = recordingConsentRevisionRef.current;
    if (
      !captureAuthorizedRef.current ||
      recordingConsentRevision === null ||
      !hasHaruVoicePipelineConsent(consentAtFinish)
    ) {
      setIsTranscribing(false);
      finishResponse(
        {
          questionId: question.exerciseId,
          responseType: "voice",
          responseTimeMs: responseTimeMs(),
          isCorrect: null,
          voiceDurationSeconds: 0,
          sttStatus: "failed",
          recognitionError:
            getHaruVoiceConsentError(consentAtFinish) ?? "voice-consent-required",
          feedback: feedbackFor(null, false),
        },
        {},
      );
      return;
    }

    const artifact = await recorder.stopAndFinalize();
    const consentAfterFinalization = getHaruConsent();
    const canRetainAudio =
      captureAuthorizedRef.current &&
      consentRevisionRef.current === recordingConsentRevision &&
      recordingConsentRevisionRef.current === recordingConsentRevision &&
      hasHaruVoicePipelineConsent(consentAfterFinalization);
    const blob = canRetainAudio ? artifact?.blob ?? null : null;
    const durationSeconds = Math.max(
      0,
      canRetainAudio ? (artifact?.durationMs ?? recorder.getDurationMs()) / 1000 : 0,
    );
    const recognitionError = !canRetainAudio
      ? getHaruVoiceConsentError(consentAfterFinalization) ?? "voice-consent-required"
      : blob && blob.size > 0
        ? "stt-pending"
        : recorder.error ?? "audio-unavailable";

    setIsTranscribing(false);
    finishResponse(
      {
        questionId: question.exerciseId,
        responseType: "voice",
          responseTimeMs: responseTimeMs(),
          isCorrect: null,
          voiceDurationSeconds: durationSeconds,
          sttStatus: "failed",
          recognitionError,
          feedback: feedbackFor(null, false),
      },
      {
        ...(canRetainAudio && artifact?.startedAt
          ? { recordingStartedAt: artifact.startedAt }
          : {}),
        ...(canRetainAudio && artifact?.endedAt
          ? { recordingEndedAt: artifact.endedAt }
          : {}),
        ...(blob && blob.size > 0 ? { audioBlob: blob } : {}),
        ...(canRetainAudio &&
        (artifact?.sampleRateHz ?? recorder.sampleRateHz) !== null
          ? { audioSampleRateHz: artifact?.sampleRateHz ?? recorder.sampleRateHz ?? undefined }
          : {}),
        ...(canRetainAudio &&
        (artifact?.channelCount ?? recorder.channelCount) !== null
          ? { audioChannelCount: artifact?.channelCount ?? recorder.channelCount ?? undefined }
          : {}),
      },
    );
  };

  const choiceState = (selected: boolean): ChoiceCardState => {
    if (!hasResponded) return selected ? "selected" : "idle";
    if (!selected) return "disabled";
    if (responseCorrectness === false) return "incorrect";
    return "correct";
  };

  const overlineKey =
    question.responseType === "voice"
      ? "exercise.memory.story.label"
      : question.responseType === "button_sequence"
        ? "exercise.sequenceOrder.prompt"
        : "exercise.multipleChoice.prompt";
  const shapeReference =
    exercise.id === "D5_Q5" && typeof exercise.correctAnswer === "string"
      ? options.find((option) => option.id === exercise.correctAnswer)
      : undefined;

  return (
    <div className="flex w-full flex-col gap-8" data-response-type={question.responseType}>
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold uppercase tracking-wide text-primary-600">
          {t(overlineKey)}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
        <Button3D
          variant="secondary"
          feedbackCue="none"
          onClick={handleReplay}
        >
          <Volume2 className="mr-2 h-5 w-5" aria-hidden="true" />
          {t(
            question.responseType === "button_sequence"
              ? "exercise.sequenceOrder.listen"
              : "exercise.audioChoice.play",
          )}
        </Button3D>
      </div>

      {shapeReference && (
        <div
          data-testid="haru-shape-reference"
          aria-label={getLocalizedText(shapeReference.label, i18n.language)}
          className="rounded-3xl border-4 border-primary-200 bg-primary-50 px-6 py-8 text-center text-5xl font-extrabold tracking-[0.2em] text-primary-900"
        >
          <span aria-hidden="true">{getLocalizedText(shapeReference.label, i18n.language)}</span>
        </div>
      )}

      {question.responseType === "single_choice" && (
        <div
          ref={choiceGridRef}
          className="grid grid-cols-2 gap-4"
          data-testid="haru-choice-grid"
        >
          {options.map((option, index) => (
            <ChoiceCard
              key={option.id}
              id={option.id}
              label={getLocalizedText(option.label, i18n.language)}
              state={choiceState(selectedOptionId === option.id)}
              onSelect={handleSingleChoice}
              layout="tile"
              keyboardShortcut={choiceKeyBindings[index]?.key}
              tone={getHaruChoiceTone(option.id)}
            />
          ))}
        </div>
      )}

      {question.responseType === "button_sequence" && (
        <>
          <div
            ref={choiceGridRef}
            className="grid grid-cols-2 gap-4"
            data-testid="haru-choice-grid"
          >
            {items.map((item, index) => {
              const selectedIndex = selectedSequence.indexOf(item.id);
              const label = getLocalizedText(item.label, i18n.language);
              return (
                <ChoiceCard
                  key={item.id}
                  id={item.id}
                  label={selectedIndex >= 0 ? `${selectedIndex + 1}. ${label}` : label}
                  state={choiceState(selectedIndex >= 0)}
                  onSelect={handleSequenceChoice}
                  layout="tile"
                  keyboardShortcut={choiceKeyBindings[index]?.key}
                  tone={getHaruChoiceTone(item.id)}
                />
              );
            })}
          </div>
        </>
      )}

      {isChoiceQuestion && (
        <div
          className="relative z-30 mx-auto w-full max-w-md"
          data-testid="haru-choice-confirm"
        >
          <Button3D
            variant={canSubmitChoice ? "primary" : "disabled"}
            fullWidth
            onClick={
              question.responseType === "single_choice"
                ? handleSingleSubmit
                : handleSequenceSubmit
            }
          >
            {t("exercise.check")}
          </Button3D>
        </div>
      )}

      {question.responseType === "voice" && (
        <>
          <div
            className={`flex flex-col items-center gap-4 rounded-2xl border-[3px] p-6 ring-4 ${
              recorder.isRecording
                ? "border-red-500 bg-red-50 ring-red-200"
                : "border-primary-500 bg-primary-50 ring-primary-200"
            }`}
          >
            <span className="text-2xl font-extrabold text-primary-800" role="status">
              {isTranscribing
                ? t("speech.transcribing")
                : recorder.isRecording
                  ? t("speech.listeningTitle")
                  : recorder.isFinalizing
                    ? t("exercise.memory.story.finalizingLabel")
                    : t("exercise.memory.story.readyLabel")}
            </span>
            <VoiceWaveform
              levels={recorder.levels}
              active={recorder.isRecording}
              ariaLabel={t("speech.listeningTitle")}
            />
            <p className="text-base font-semibold text-gray-600">
              {t("speech.durationLimit", { seconds: maxDurationSeconds })}
            </p>
          </div>

          {!speechConsentGranted && (
            <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-relaxed text-amber-900">
              {t("exercise.memory.story.privacy")}
            </p>
          )}
          {speechConsentGranted && !recorder.isSupported && (
            <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-relaxed text-amber-900">
              {t("exercise.memory.story.unsupported")}
            </p>
          )}

          <div className="fixed bottom-[96px] left-0 right-0 z-30 mx-auto max-w-md px-4">
            <Button3D
              variant={isTranscribing || hasResponded ? "disabled" : "primary"}
              fullWidth
              onClick={handleVoiceFinish}
            >
              {isTranscribing ? t("speech.transcribing") : t("exercise.memory.story.finish")}
            </Button3D>
          </div>
        </>
      )}
    </div>
  );
}
