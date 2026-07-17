import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
  type HaruQuestionResponseType,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { Exercise } from "@/data/mockExercises";
import {
  clearHaruAdminAudioStorage,
  deleteHaruAdminAudio,
  storeHaruAdminAudio,
  type HaruAdminAudioRetentionStatus,
} from "@/features/lessons/haruAdminAudioStorage";
import type { HaruPersonalizationRecord } from "@/features/lessons/haruDemoSessionStorage";
import {
  clearHaruRagOutbox,
  enqueueHaruRagRecord,
  enqueueHaruRagUserDeletion,
} from "@/features/lessons/haruRagSync";
import type { HaruDerivedAnnotation } from "@/features/lessons/haruResponseFacts";
import {
  clearHaruSttRetryOutbox,
  reconcileHaruSttRetryOutbox,
  type HaruSttRetryPatchResult,
  type HaruSttRetrySuccess,
} from "@/features/lessons/haruSttRetry";
import { getLocalizedText } from "@/utils/localizedText";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_ADMIN_USAGE_RECORD_STORAGE_KEY = "haruAdminUsageRecord";
export const HARU_ADMIN_USAGE_RECORD_UPDATED_EVENT = "haru:admin-usage-record-updated";

export type HaruAdminButton = "A" | "B" | "C" | "D";
export type HaruAdminInputMode = "physical_button" | "touch" | "voice";

const USER_ID = "USR-000001";
const CARD_TOKEN_ID = "CARD-DEMO-000001";
const DEVICE_ID = "KIOSK-DEMO-001";
const DATASET_ID = "HARU-DEMO-USER-001-WEEK-01";
const BUTTONS: readonly HaruAdminButton[] = ["A", "B", "C", "D"];

const BUTTON_LAYOUT = {
  A: { position: "왼쪽 위", color: "빨강" },
  B: { position: "오른쪽 위", color: "노랑" },
  C: { position: "왼쪽 아래", color: "초록" },
  D: { position: "오른쪽 아래", color: "파랑" },
} as const;

interface HaruAdminChoice {
  button: HaruAdminButton;
  position: string;
  color: string;
  label: string;
}

interface HaruAdminEvaluation {
  is_correct: boolean | null;
  score: number | null;
}

interface HaruAdminSingleChoiceResponse {
  response_id: string;
  input_mode: Exclude<HaruAdminInputMode, "voice">;
  button_event: {
    button: HaruAdminButton;
    position: string;
    color: string;
    pressed_at: string;
  };
  selected_choice: { button: HaruAdminButton; label: string };
  response_time_ms: number;
  evaluation: HaruAdminEvaluation;
  is_valid: boolean;
}

interface HaruAdminSequenceResponse {
  response_id: string;
  input_mode: "physical_button_sequence" | "touch_sequence";
  button_events: Array<{
    sequence_index: number;
    button: HaruAdminButton;
    choice_label: string;
    pressed_at: string;
    elapsed_ms_from_question: number;
  }>;
  submitted_sequence: HaruAdminButton[];
  submitted_labels: string[];
  submitted_at: string;
  response_time_ms: number;
  evaluation: HaruAdminEvaluation;
  is_valid: boolean;
}

interface HaruAdminVoiceResponse {
  response_id: string;
  input_mode: "voice";
  recording_started_at: string | null;
  recording_ended_at: string | null;
  audio_duration_seconds: number;
  audio_storage: {
    object_key: string;
    mime_type: string | null;
    sample_rate_hz: number | null;
    channels: number | null;
    retention_status: HaruAdminAudioRetentionStatus;
  };
  raw_user_utterance_transcript: string | null;
  stt: {
    engine: string;
    status: "completed" | "failed";
    no_speech: boolean;
    transcript: string | null;
    language: string | null;
    confidence: number | null;
    processed_at: string | null;
    model: string | null;
    model_revision: string | null;
    aligner_model: string | null;
    aligner_revision: string | null;
    preprocessing_version: string | null;
    segments: Array<{
      id: number;
      start: number;
      end: number;
      text: string;
    }>;
  };
  user_correction: {
    was_corrected: false;
    corrected_transcript: null;
  };
  derived_annotations: {
    status: "completed" | "empty";
    items: Array<{ entity_type: string; value: string }>;
    note: string;
  };
  response_time_ms: number;
  is_valid: boolean;
}

type HaruAdminResponse =
  | HaruAdminSingleChoiceResponse
  | HaruAdminSequenceResponse
  | HaruAdminVoiceResponse;

export interface HaruAdminQuestionRecord {
  presentation: {
    presented_at: string;
    screen_state: "question";
    character_message: string | null;
  };
  question: {
    question_id: string;
    order: number;
    domain: string;
    response_type: HaruQuestionResponseType;
    prompt_text: string;
    prompt_audio_text: string;
    scored: boolean;
    choices: HaruAdminChoice[] | null;
    correct_answer:
      | { button: HaruAdminButton; label: string }
      | { sequence: HaruAdminButton[]; labels: string[] }
      | null;
    personalization_source_note: string | null;
    max_response_seconds: number | null;
  };
  response: HaruAdminResponse | null;
  system_feedback: {
    feedback_text: string;
    shown_at: string;
  } | null;
}

export interface HaruAdminUsageSession {
  session_id: string;
  user_id: string;
  device_id: string;
  session_date: string;
  weekday: string;
  authentication: {
    method: "registered_card";
    card_token_id: string;
    authenticated_at: string;
    result: "success";
  };
  session_started_at: string;
  session_completed_at: string | null;
  completion_status: "in_progress" | "completed" | "abandoned";
  question_count: number;
  question_records: HaruAdminQuestionRecord[];
  session_summary: {
    duration_seconds: number;
    scored_question_count: number;
    correct_count: number;
    incorrect_count: number;
    completion_message: string;
    clinical_interpretation: null;
    risk_classification: null;
    admin_note: string;
  } | null;
}

export interface HaruAdminUsageRecord {
  schema: {
    name: "haru_kiosk_usage_record";
    version: "1.0.0";
    purpose: string;
    recording_principle: string[];
  };
  dataset: {
    dataset_id: string;
    generated_at: string;
    data_classification: string;
    is_synthetic: true;
    period: { start: string; end: string };
  };
  user: {
    user_id: string;
    card_token_id: string;
    display_name: string;
    birth_year: number;
    age_at_period_start: number;
    gender: string;
    residence: string;
    living_arrangement: string;
    speech_profile_note: string;
    registered_profile_fields: Record<string, string>;
    consents: {
      voice_recording: boolean;
      stt_processing: boolean;
      longitudinal_usage_storage: boolean;
      personalized_question_use: boolean;
      consented_at: string;
    };
  };
  device: {
    device_id: string;
    site_id: string;
    site_name: string;
    input_devices: string[];
    button_layout: typeof BUTTON_LAYOUT;
    software_version: string;
    timezone: "Asia/Seoul";
  };
  sessions: HaruAdminUsageSession[];
}

export interface HaruAdminSequenceButtonEventInput {
  optionId: string;
  pressedAt: string;
  elapsedMsFromQuestion: number;
  inputMode?: Exclude<HaruAdminInputMode, "voice">;
}

export interface HaruAdminLiveResponseInput {
  questionId: string;
  responseType: HaruQuestionResponseType;
  selectedOptionId?: string;
  submittedSequence?: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  feedback: string;
  respondedAt?: string;
  inputMode?: Exclude<HaruAdminInputMode, "voice">;
  buttonPressedAt?: string;
  sequenceButtonEvents?: HaruAdminSequenceButtonEventInput[];
  voiceDurationSeconds?: number;
  recordingStartedAt?: string;
  recordingEndedAt?: string;
  audioBlob?: Blob;
  audioSampleRateHz?: number;
  audioChannelCount?: number;
  sttStatus?: "completed" | "failed";
  sttNoSpeech?: boolean;
  sttLanguage?: string;
  sttConfidence?: number;
  sttProcessedAt?: string;
  sttEngine?: string;
  sttModel?: string;
  sttModelRevision?: string;
  sttAlignerModel?: string;
  sttAlignerRevision?: string;
  sttPreprocessingVersion?: string;
  sttSegments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  rawUserUtteranceTranscript?: string;
  derivedAnnotations?: HaruDerivedAnnotation[];
}

function toSeoulIsoString(date: Date): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Date(safeDate.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "+09:00");
}

function normalizeTimestamp(value: string | undefined, fallback: Date): string {
  if (!value) return toSeoulIsoString(fallback);
  const parsed = new Date(value);
  return toSeoulIsoString(Number.isNaN(parsed.getTime()) ? fallback : parsed);
}

function normalizeOptionalTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toSeoulIsoString(parsed);
}

function isStoredRecord(value: unknown): value is HaruAdminUsageRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<HaruAdminUsageRecord>;
  return (
    candidate.schema?.name === "haru_kiosk_usage_record" &&
    candidate.schema.version === "1.0.0" &&
    candidate.user?.user_id === USER_ID &&
    candidate.device?.device_id === DEVICE_ID &&
    Array.isArray(candidate.sessions) &&
    candidate.sessions.every(
      (session) =>
        session !== null &&
        typeof session === "object" &&
        typeof session.session_date === "string" &&
        Array.isArray(session.question_records),
    )
  );
}

function createEmptyRecord(now: Date): HaruAdminUsageRecord {
  const profile = HARU_DEMO_PERSONA.registeredProfileFields;
  return {
    schema: {
      name: "haru_kiosk_usage_record",
      version: "1.0.0",
      purpose:
        "시스템 관리자가 실제 사용 세션에서 저장되는 사용자·문항·응답·처리 결과를 확인하기 위한 데모 데이터",
      recording_principle: [
        "Knowledge Graph 자체는 포함하지 않음",
        "사용자에게 실제 제시된 문항 스냅샷을 저장",
        "버튼 입력은 물리 버튼, 선택지, 입력 시각, 반응시간을 저장",
        "음성 입력은 음성 파일 참조, 원문 전사, STT 결과와 처리 상태를 저장",
        "정답 여부와 점수는 내부 운영 데이터이며 사용자 화면의 진단 판정과 분리",
      ],
    },
    dataset: {
      dataset_id: DATASET_ID,
      generated_at: toSeoulIsoString(now),
      data_classification: "발표·개발용 가상 개인정보",
      is_synthetic: true,
      period: { start: "2026-07-20", end: "2026-07-26" },
    },
    user: {
      user_id: USER_ID,
      card_token_id: CARD_TOKEN_ID,
      display_name: getLocalizedText(HARU_DEMO_PERSONA.name, "ko"),
      birth_year: HARU_DEMO_PERSONA.birthYear,
      age_at_period_start: HARU_DEMO_PERSONA.age,
      gender: getLocalizedText(HARU_DEMO_PERSONA.gender, "ko"),
      residence: getLocalizedText(HARU_DEMO_PERSONA.residence, "ko"),
      living_arrangement: getLocalizedText(HARU_DEMO_PERSONA.livingArrangement, "ko"),
      speech_profile_note: getLocalizedText(HARU_DEMO_PERSONA.speechProfileNote, "ko"),
      registered_profile_fields: {
        고향: getLocalizedText(profile.hometown, "ko"),
        졸업학교: getLocalizedText(profile.elementarySchool, "ko"),
        과거직업: getLocalizedText(profile.formerOccupation, "ko"),
        딸: getLocalizedText(profile.daughterName, "ko"),
        손자: getLocalizedText(profile.grandsonName, "ko"),
        가까운친구: getLocalizedText(profile.closeFriendName, "ko"),
        이웃: getLocalizedText(profile.neighborName, "ko"),
        좋아하는음식: getLocalizedText(profile.favoriteFood, "ko"),
        복약시간: getLocalizedText(profile.medicationTime, "ko"),
      },
      consents: {
        voice_recording: HARU_DEMO_PERSONA.consents.voiceRecording,
        stt_processing: HARU_DEMO_PERSONA.consents.sttProcessing,
        longitudinal_usage_storage: HARU_DEMO_PERSONA.consents.longitudinalUsageStorage,
        personalized_question_use: HARU_DEMO_PERSONA.consents.personalizedQuestionUse,
        consented_at: HARU_DEMO_PERSONA.consents.consentedAt,
      },
    },
    device: {
      device_id: DEVICE_ID,
      site_id: "SITE-DEMO-YUSEONG-01",
      site_name: "유성구 복지관 데모존",
      input_devices: ["microphone", "physical_button_2x2", "card_reader"],
      button_layout: BUTTON_LAYOUT,
      software_version: "haru-demo-0.3.0",
      timezone: "Asia/Seoul",
    },
    sessions: [],
  };
}

function dispatchUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HARU_ADMIN_USAGE_RECORD_UPDATED_EVENT));
}

function saveRecord(record: HaruAdminUsageRecord): boolean {
  const saved = writeJson(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, record);
  if (saved) {
    reconcileHaruSttRetryOutbox(record);
    if (
      HARU_DEMO_PERSONA.consents.longitudinalUsageStorage &&
      record.user.consents.longitudinal_usage_storage
    ) {
      enqueueHaruRagRecord(record);
    } else {
      clearHaruRagOutbox();
    }
    dispatchUpdate();
  }
  return saved;
}

function buttonForOption(
  optionId: string,
  exercise: Exercise,
): HaruAdminButton | null {
  if (BUTTONS.includes(optionId as HaruAdminButton)) {
    return optionId as HaruAdminButton;
  }
  const choices = exercise.payload.options ?? exercise.payload.items ?? [];
  const index = choices.findIndex((choice) => choice.id === optionId);
  return index >= 0 && index < BUTTONS.length ? BUTTONS[index] : null;
}

function choicesFor(exercise: Exercise, language: string): HaruAdminChoice[] | null {
  const source = exercise.payload.options ?? exercise.payload.items;
  if (!source || source.length === 0) return null;
  return source.slice(0, 4).map((choice, index) => {
    const button = BUTTONS[index];
    return {
      button,
      ...BUTTON_LAYOUT[button],
      label: getLocalizedText(choice.label, language),
    };
  });
}

function correctAnswerFor(
  exercise: Exercise,
  choices: HaruAdminChoice[] | null,
): HaruAdminQuestionRecord["question"]["correct_answer"] {
  if (!choices || exercise.correctAnswer === null) return null;
  if (typeof exercise.correctAnswer === "string") {
    const button = buttonForOption(exercise.correctAnswer, exercise);
    const choice = choices.find((candidate) => candidate.button === button);
    return button && choice ? { button, label: choice.label } : null;
  }
  const sequence = exercise.correctAnswer
    .map((id) => buttonForOption(id, exercise))
    .filter((button): button is HaruAdminButton => button !== null);
  return sequence.length === exercise.correctAnswer.length
    ? {
        sequence,
        labels: sequence.map(
          (button) => choices.find((choice) => choice.button === button)?.label ?? "",
        ),
      }
    : null;
}

function expectedQuestionIds(day: HaruWeekDay): readonly string[] {
  return getHaruWeekPlan(day).exerciseIds;
}

function hasCompleteValidResponses(
  session: HaruAdminUsageSession,
  day: HaruWeekDay,
): boolean {
  const expected = expectedQuestionIds(day);
  if (expected.length === 0 || session.question_records.length !== expected.length) {
    return false;
  }
  const ids = session.question_records.map((record) => record.question.question_id);
  return (
    new Set(ids).size === expected.length &&
    expected.every((id) => {
      const record = session.question_records.find(
        (candidate) => candidate.question.question_id === id,
      );
      return record?.response?.is_valid === true && record.system_feedback !== null;
    })
  );
}

export function getHaruAdminUsageRecord(): HaruAdminUsageRecord | null {
  const stored = readJson<unknown>(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY, null);
  return isStoredRecord(stored) ? stored : null;
}

export function startHaruAdminUsageSession(
  day: HaruWeekDay,
  now: Date = new Date(),
): HaruAdminUsageSession | null {
  if (!HARU_DEMO_PERSONA.consents.longitudinalUsageStorage) {
    clearHaruSttRetryOutbox();
    clearHaruRagOutbox();
    return null;
  }

  const record = getHaruAdminUsageRecord() ?? createEmptyRecord(now);
  const existingIndex = record.sessions.findIndex(
    (session) => session.session_date === getHaruWeekPlan(day).dateISO,
  );
  const existing = record.sessions[existingIndex];
  if (
    existing?.completion_status === "completed" ||
    existing?.completion_status === "in_progress"
  ) {
    return existing;
  }

  const plan = getHaruWeekPlan(day);
  const timestamp = toSeoulIsoString(now);
  const session: HaruAdminUsageSession = existing
    ? {
        ...existing,
        authentication: {
          ...existing.authentication,
          authenticated_at: timestamp,
          result: "success",
        },
        session_started_at: timestamp,
        session_completed_at: null,
        completion_status: "in_progress",
        session_summary: null,
      }
    : {
        session_id: `SES-${plan.dateISO.replaceAll("-", "")}-USR000001`,
        user_id: USER_ID,
        device_id: DEVICE_ID,
        session_date: plan.dateISO,
        weekday: getLocalizedText(plan.weekday, "ko"),
        authentication: {
          method: "registered_card",
          card_token_id: CARD_TOKEN_ID,
          authenticated_at: timestamp,
          result: "success",
        },
        session_started_at: timestamp,
        session_completed_at: null,
        completion_status: "in_progress",
        question_count: plan.exerciseIds.length,
        question_records: [],
        session_summary: null,
      };

  if (existingIndex >= 0) record.sessions[existingIndex] = session;
  else record.sessions.push(session);
  record.sessions.sort((left, right) => left.session_date.localeCompare(right.session_date));
  saveRecord(record);
  return session;
}

export function presentHaruAdminQuestion(
  day: HaruWeekDay,
  exercise: Exercise,
  language: string,
  personalization?: HaruPersonalizationRecord,
  now: Date = new Date(),
): HaruAdminQuestionRecord | null {
  const session = startHaruAdminUsageSession(day, now);
  if (!session || session.completion_status !== "in_progress") return null;
  const record = getHaruAdminUsageRecord();
  if (!record) return null;
  const storedSession = record.sessions.find((candidate) => candidate.session_id === session.session_id);
  if (!storedSession) return null;
  const existing = storedSession.question_records.find(
    (candidate) => candidate.question.question_id === exercise.id,
  );
  if (existing) return existing;

  const meta = HARU_WEEK_QUESTION_META.find(
    (candidate) => candidate.day === day && candidate.exerciseId === exercise.id,
  );
  if (!meta || !expectedQuestionIds(day).includes(exercise.id)) return null;
  const choices = choicesFor(exercise, language);
  const usePersonalizationNote =
    personalization?.kind === "profile" || personalization?.kind === "prior_response";
  const questionRecord: HaruAdminQuestionRecord = {
    presentation: {
      presented_at: toSeoulIsoString(now),
      screen_state: "question",
      character_message: null,
    },
    question: {
      question_id: exercise.id,
      order: meta.order,
      domain: meta.domain,
      response_type: meta.responseType,
      prompt_text: getLocalizedText(exercise.prompt, language),
      prompt_audio_text: getLocalizedText(
        exercise.payload.audioText ?? exercise.prompt,
        language,
      ),
      scored: meta.scored,
      choices,
      correct_answer: correctAnswerFor(exercise, choices),
      personalization_source_note:
        usePersonalizationNote && meta.personalizationSourceNote
          ? getLocalizedText(meta.personalizationSourceNote, language)
          : null,
      max_response_seconds: meta.maxResponseSeconds ?? null,
    },
    response: null,
    system_feedback: null,
  };
  storedSession.question_records.push(questionRecord);
  storedSession.question_records.sort((left, right) => left.question.order - right.question.order);
  saveRecord(record);
  return questionRecord;
}

function evaluationFor(isCorrect: boolean | null, scored: boolean): HaruAdminEvaluation {
  return {
    is_correct: scored ? isCorrect : null,
    score: scored && typeof isCorrect === "boolean" ? (isCorrect ? 1 : 0) : null,
  };
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function singleChoiceResponse(
  input: HaruAdminLiveResponseInput,
  exercise: Exercise,
  questionRecord: HaruAdminQuestionRecord,
  respondedAt: string,
): HaruAdminSingleChoiceResponse | null {
  if (!input.selectedOptionId) return null;
  const button = buttonForOption(input.selectedOptionId, exercise);
  const choice = questionRecord.question.choices?.find(
    (candidate) => candidate.button === button,
  );
  if (!button || !choice) return null;
  const computedCorrect = questionRecord.question.scored
    ? typeof exercise.correctAnswer === "string" &&
      input.selectedOptionId === exercise.correctAnswer
    : null;
  return {
    response_id: `RES-${input.questionId}`,
    input_mode: input.inputMode ?? "touch",
    button_event: {
      button,
      position: choice.position,
      color: choice.color,
      pressed_at: normalizeTimestamp(input.buttonPressedAt, new Date(respondedAt)),
    },
    selected_choice: { button, label: choice.label },
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    evaluation: evaluationFor(computedCorrect, questionRecord.question.scored),
    is_valid: true,
  };
}

function sequenceResponse(
  input: HaruAdminLiveResponseInput,
  exercise: Exercise,
  questionRecord: HaruAdminQuestionRecord,
  respondedAt: string,
): HaruAdminSequenceResponse | null {
  const submitted = input.submittedSequence ?? [];
  const expectedCount = exercise.payload.requiredSelectionCount ?? 0;
  if (submitted.length !== expectedCount || new Set(submitted).size !== submitted.length) {
    return null;
  }
  const sequence = submitted
    .map((id) => buttonForOption(id, exercise))
    .filter((button): button is HaruAdminButton => button !== null);
  if (sequence.length !== submitted.length) return null;
  const correctSequence = Array.isArray(exercise.correctAnswer)
    ? exercise.correctAnswer
    : [];
  const computedCorrect = questionRecord.question.scored
    ? submitted.length === correctSequence.length &&
      submitted.every((id, index) => id === correctSequence[index])
    : null;
  const labels = sequence.map(
    (button) =>
      questionRecord.question.choices?.find((choice) => choice.button === button)?.label ?? "",
  );
  const inputMode = input.sequenceButtonEvents?.some(
    (event) => event.inputMode === "physical_button",
  )
    ? "physical_button_sequence"
    : "touch_sequence";
  const eventByOption = new Map(
    input.sequenceButtonEvents?.map((event) => [event.optionId, event]) ?? [],
  );
  return {
    response_id: `RES-${input.questionId}`,
    input_mode: inputMode,
    button_events: submitted.map((optionId, index) => {
      const button = sequence[index];
      const event = eventByOption.get(optionId);
      return {
        sequence_index: index + 1,
        button,
        choice_label: labels[index],
        pressed_at: normalizeTimestamp(event?.pressedAt, new Date(respondedAt)),
        elapsed_ms_from_question:
          event?.elapsedMsFromQuestion ?? Math.max(0, Math.round(input.responseTimeMs)),
      };
    }),
    submitted_sequence: sequence,
    submitted_labels: labels,
    submitted_at: respondedAt,
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    evaluation: evaluationFor(computedCorrect, questionRecord.question.scored),
    is_valid: true,
  };
}

async function voiceResponse(
  input: HaruAdminLiveResponseInput,
  sessionDate: string,
  respondedAt: string,
): Promise<HaruAdminVoiceResponse> {
  const objectKey = `voice/${USER_ID}/${sessionDate}/${input.questionId}.${
    input.audioBlob?.type.includes("ogg") ? "ogg" : "webm"
  }`;
  const mayStoreAudio =
    HARU_DEMO_PERSONA.consents.voiceRecording &&
    HARU_DEMO_PERSONA.consents.longitudinalUsageStorage &&
    input.audioBlob !== undefined &&
    input.audioBlob.size > 0;
  const retentionStatus = mayStoreAudio
    ? await storeHaruAdminAudio(objectKey, input.audioBlob!, respondedAt)
    : "not_stored";
  const mayStoreTranscript =
    HARU_DEMO_PERSONA.consents.sttProcessing &&
    HARU_DEMO_PERSONA.consents.longitudinalUsageStorage;
  const noSpeech = mayStoreTranscript && input.sttNoSpeech === true;
  const transcript = mayStoreTranscript && !noSpeech
    ? (input.rawUserUtteranceTranscript?.trim().slice(0, 10_000) || null)
    : null;
  const annotations = mayStoreTranscript && !noSpeech
    ? (input.derivedAnnotations ?? [])
        .filter(
          (annotation) =>
            annotation.entityType.trim().length > 0 && annotation.value.trim().length > 0,
        )
        .slice(0, 24)
    : [];
  return {
    response_id: `RES-${input.questionId}`,
    input_mode: "voice",
    recording_started_at: normalizeOptionalTimestamp(input.recordingStartedAt),
    recording_ended_at: normalizeOptionalTimestamp(input.recordingEndedAt),
    audio_duration_seconds: Math.max(0, input.voiceDurationSeconds ?? 0),
    audio_storage: {
      object_key: objectKey,
      mime_type: input.audioBlob?.type || null,
      sample_rate_hz:
        input.audioSampleRateHz !== undefined &&
        Number.isFinite(input.audioSampleRateHz) &&
        input.audioSampleRateHz > 0
          ? Math.round(input.audioSampleRateHz)
          : null,
      channels:
        input.audioChannelCount !== undefined &&
        Number.isFinite(input.audioChannelCount) &&
        input.audioChannelCount > 0
          ? Math.round(input.audioChannelCount)
          : null,
      retention_status: retentionStatus,
    },
    raw_user_utterance_transcript: transcript,
    stt: {
      engine: input.sttEngine?.trim().slice(0, 240) || "haru-local-stt",
      status: noSpeech ? "failed" : (input.sttStatus ?? "failed"),
      no_speech: noSpeech,
      transcript,
      language: input.sttLanguage ?? null,
      confidence:
        input.sttConfidence !== undefined &&
        Number.isFinite(input.sttConfidence) &&
        input.sttConfidence >= 0 &&
        input.sttConfidence <= 1
          ? input.sttConfidence
          : null,
      processed_at: normalizeOptionalTimestamp(input.sttProcessedAt),
      model: mayStoreTranscript
        ? (input.sttModel?.trim().slice(0, 240) || null)
        : null,
      model_revision: mayStoreTranscript
        ? (input.sttModelRevision?.trim().slice(0, 160) || null)
        : null,
      aligner_model: mayStoreTranscript
        ? (input.sttAlignerModel?.trim().slice(0, 240) || null)
        : null,
      aligner_revision: mayStoreTranscript
        ? (input.sttAlignerRevision?.trim().slice(0, 160) || null)
        : null,
      preprocessing_version: mayStoreTranscript
        ? (input.sttPreprocessingVersion?.trim().slice(0, 160) || null)
        : null,
      segments:
        mayStoreTranscript && !noSpeech
          ? (input.sttSegments ?? [])
              .filter(
                (segment) =>
                  Number.isInteger(segment.id) &&
                  segment.id >= 0 &&
                  Number.isFinite(segment.start) &&
                  segment.start >= 0 &&
                  Number.isFinite(segment.end) &&
                  segment.end >= segment.start &&
                  segment.text.trim().length > 0,
              )
              .slice(0, 2_000)
              .map((segment) => ({
                id: segment.id,
                start: Math.round(segment.start * 1_000) / 1_000,
                end: Math.round(segment.end * 1_000) / 1_000,
                text: segment.text.trim().slice(0, 500),
              }))
          : [],
    },
    user_correction: { was_corrected: false, corrected_transcript: null },
    derived_annotations: {
      status: annotations.length > 0 ? "completed" : "empty",
      items: annotations.map((annotation) => ({
        entity_type: annotation.entityType.trim().slice(0, 40),
        value: annotation.value.trim().slice(0, 120),
      })),
      note: "향후 개인화 문항 생성에 사용할 수 있는 파생 정보. 원문 응답과 분리 저장.",
    },
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    is_valid: true,
  };
}

export async function recordHaruAdminResponse(
  day: HaruWeekDay,
  exercise: Exercise,
  language: string,
  input: HaruAdminLiveResponseInput,
  personalization?: HaruPersonalizationRecord,
  now: Date = new Date(),
): Promise<HaruAdminQuestionRecord | null> {
  if (!HARU_DEMO_PERSONA.consents.longitudinalUsageStorage) {
    clearHaruSttRetryOutbox();
    clearHaruRagOutbox();
    return null;
  }
  if (!isNonNegativeFinite(input.responseTimeMs)) return null;
  if (
    input.voiceDurationSeconds !== undefined &&
    !isNonNegativeFinite(input.voiceDurationSeconds)
  ) {
    return null;
  }
  const fallbackPresentedAt = new Date(now.getTime() - Math.max(0, input.responseTimeMs));
  presentHaruAdminQuestion(day, exercise, language, personalization, fallbackPresentedAt);
  const record = getHaruAdminUsageRecord();
  if (!record) return null;
  const plan = getHaruWeekPlan(day);
  const session = record.sessions.find((candidate) => candidate.session_date === plan.dateISO);
  const questionRecord = session?.question_records.find(
    (candidate) => candidate.question.question_id === input.questionId,
  );
  if (
    !session ||
    !questionRecord ||
    session.completion_status !== "in_progress" ||
    questionRecord.response !== null ||
    input.questionId !== exercise.id ||
    input.responseType !== questionRecord.question.response_type
  ) {
    return questionRecord ?? null;
  }

  const respondedAt = normalizeTimestamp(input.respondedAt, now);
  const response: HaruAdminResponse | null =
    input.responseType === "single_choice"
      ? singleChoiceResponse(input, exercise, questionRecord, respondedAt)
      : input.responseType === "button_sequence"
        ? sequenceResponse(input, exercise, questionRecord, respondedAt)
        : await voiceResponse(input, plan.dateISO, respondedAt);
  if (!response) return null;

  const latestRecord = getHaruAdminUsageRecord();
  const latestSession = latestRecord?.sessions.find(
    (candidate) => candidate.session_date === plan.dateISO,
  );
  const latestQuestionRecord = latestSession?.question_records.find(
    (candidate) => candidate.question.question_id === input.questionId,
  );
  if (
    !latestRecord ||
    !latestSession ||
    !latestQuestionRecord ||
    latestSession.completion_status !== "in_progress"
  ) {
    if (
      response.input_mode === "voice" &&
      response.audio_storage.retention_status === "stored"
    ) {
      await deleteHaruAdminAudio(response.audio_storage.object_key);
    }
    return null;
  }
  if (latestQuestionRecord.response !== null) return latestQuestionRecord;

  latestQuestionRecord.response = response;
  latestQuestionRecord.presentation.character_message = input.feedback;
  latestQuestionRecord.system_feedback = {
    feedback_text: input.feedback,
    shown_at: respondedAt,
  };
  if (!saveRecord(latestRecord)) {
    if (
      response.input_mode === "voice" &&
      response.audio_storage.retention_status === "stored"
    ) {
      await deleteHaruAdminAudio(response.audio_storage.object_key);
    }
    return null;
  }
  return latestQuestionRecord;
}

export function patchHaruAdminVoiceSttSuccess(
  success: HaruSttRetrySuccess,
): HaruSttRetryPatchResult {
  const record = getHaruAdminUsageRecord();
  if (
    !record ||
    record.user.user_id !== success.userId ||
    !HARU_DEMO_PERSONA.consents.voiceRecording ||
    !HARU_DEMO_PERSONA.consents.sttProcessing ||
    !HARU_DEMO_PERSONA.consents.longitudinalUsageStorage ||
    !record.user.consents.voice_recording ||
    !record.user.consents.stt_processing ||
    !record.user.consents.longitudinal_usage_storage
  ) {
    return "stale";
  }

  const session = record.sessions.find(
    (candidate) => candidate.session_date === success.sessionDate,
  );
  const questionRecord = session?.question_records.find(
    (candidate) => candidate.question.question_id === success.questionId,
  );
  const response = questionRecord?.response;
  if (
    response?.input_mode !== "voice" ||
    response.audio_storage.object_key !== success.objectKey ||
    response.audio_storage.retention_status !== "stored"
  ) {
    return "stale";
  }
  if (response.stt.status === "completed") return "stale";

  const noSpeech = success.result.noSpeech;
  const transcript = noSpeech
    ? null
    : (success.result.text.trim().slice(0, 10_000) || null);
  if (!noSpeech && !transcript) return "stale";
  const annotations = noSpeech
    ? []
    : success.derivedAnnotations
        .filter(
          (annotation) =>
            annotation.entityType.trim().length > 0 &&
            annotation.value.trim().length > 0,
        )
        .slice(0, 24);
  response.raw_user_utterance_transcript = transcript;
  response.stt = {
    engine: success.engine.trim().slice(0, 240) || "haru-local-stt",
    status: noSpeech ? "failed" : "completed",
    no_speech: noSpeech,
    transcript,
    language: success.result.language?.trim().slice(0, 80) || null,
    confidence:
      success.result.confidence !== null &&
      Number.isFinite(success.result.confidence) &&
      success.result.confidence >= 0 &&
      success.result.confidence <= 1
        ? success.result.confidence
        : null,
    processed_at: normalizeTimestamp(success.processedAt, new Date()),
    model: success.result.model?.trim().slice(0, 240) || null,
    model_revision: success.result.modelRevision?.trim().slice(0, 160) || null,
    aligner_model: success.result.alignerModel?.trim().slice(0, 240) || null,
    aligner_revision: success.result.alignerRevision?.trim().slice(0, 160) || null,
    preprocessing_version:
      success.result.preprocessingVersion?.trim().slice(0, 160) || null,
    segments: noSpeech
      ? []
      : success.result.segments
          .filter(
            (segment) =>
              Number.isInteger(segment.id) &&
              segment.id >= 0 &&
              Number.isFinite(segment.start) &&
              segment.start >= 0 &&
              Number.isFinite(segment.end) &&
              segment.end >= segment.start &&
              segment.text.trim().length > 0,
          )
          .slice(0, 2_000)
          .map((segment) => ({
            id: segment.id,
            start: Math.round(segment.start * 1_000) / 1_000,
            end: Math.round(segment.end * 1_000) / 1_000,
            text: segment.text.trim().slice(0, 500),
          })),
  };
  response.derived_annotations = {
    ...response.derived_annotations,
    status: annotations.length > 0 ? "completed" : "empty",
    items: annotations.map((annotation) => ({
      entity_type: annotation.entityType.trim().slice(0, 40),
      value: annotation.value.trim().slice(0, 120),
    })),
  };
  return saveRecord(record) ? "patched" : "retry";
}

export function completeHaruAdminUsageSession(
  day: HaruWeekDay,
  completionMessage: string,
  now: Date = new Date(),
): HaruAdminUsageSession | null {
  const record = getHaruAdminUsageRecord();
  const session = record?.sessions.find(
    (candidate) => candidate.session_date === getHaruWeekPlan(day).dateISO,
  );
  if (!record || !session) return null;
  if (session.completion_status === "completed") return session;
  if (
    session.completion_status !== "in_progress" ||
    !hasCompleteValidResponses(session, day)
  ) {
    return null;
  }

  const completedAt = toSeoulIsoString(now);
  const durationSeconds = Math.max(
    0,
    Math.round(
      (new Date(completedAt).getTime() - new Date(session.session_started_at).getTime()) /
        1000,
    ),
  );
  const scoredRecords = session.question_records.filter(
    (questionRecord) => questionRecord.question.scored,
  );
  const correctCount = scoredRecords.filter((questionRecord) => {
    const response = questionRecord.response;
    return response !== null && "evaluation" in response && response.evaluation.is_correct;
  }).length;
  const incorrectCount = scoredRecords.filter((questionRecord) => {
    const response = questionRecord.response;
    return (
      response !== null &&
      "evaluation" in response &&
      response.evaluation.is_correct === false
    );
  }).length;
  session.completion_status = "completed";
  session.session_completed_at = completedAt;
  session.session_summary = {
    duration_seconds: durationSeconds,
    scored_question_count: scoredRecords.length,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    completion_message: completionMessage,
    clinical_interpretation: null,
    risk_classification: null,
    admin_note: "사용자 화면에는 진단·위험도 판정 없이 완료와 격려 중심으로 표시",
  };
  return saveRecord(record) ? session : null;
}

export function abandonHaruAdminUsageSession(
  day: HaruWeekDay,
  now: Date = new Date(),
): HaruAdminUsageSession | null {
  const record = getHaruAdminUsageRecord();
  const session = record?.sessions.find(
    (candidate) => candidate.session_date === getHaruWeekPlan(day).dateISO,
  );
  if (!record || !session || session.completion_status !== "in_progress") {
    return session ?? null;
  }
  session.completion_status = "abandoned";
  session.session_completed_at = toSeoulIsoString(now);
  session.session_summary = null;
  saveRecord(record);
  return session;
}

export async function clearHaruAdminUsageRecords(): Promise<void> {
  const record = getHaruAdminUsageRecord();
  if (record && !enqueueHaruRagUserDeletion(record.user.user_id)) {
    throw new Error("rag-deletion-outbox-write-failed");
  }
  await clearHaruAdminAudioStorage();
  clearHaruSttRetryOutbox();
  clearHaruRagOutbox();
  removeKey(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY);
  dispatchUpdate();
}
