import type {
  HaruAdminQuestionRecord,
  HaruAdminUsageRecord,
  HaruAdminUsageSession,
} from "@/features/lessons/haruAdminUsageRecordStorage";

interface ParseOptions {
  expectedUserId?: string;
  expectedDeviceId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isButton(value: unknown): value is "A" | "B" | "C" | "D" {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function isEvaluation(value: unknown): boolean {
  return (
    isRecord(value) &&
    (typeof value.is_correct === "boolean" || value.is_correct === null) &&
    (isFiniteNonNegative(value.score) || value.score === null)
  );
}

function isResponse(value: unknown, responseType: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || !isString(value.response_id) || !isFiniteNonNegative(value.response_time_ms)) {
    return false;
  }
  if (typeof value.is_valid !== "boolean") return false;

  if (responseType === "single_choice") {
    if (value.input_mode !== "physical_button" && value.input_mode !== "touch") return false;
    return (
      isRecord(value.button_event) &&
      isButton(value.button_event.button) &&
      isString(value.button_event.position) &&
      isString(value.button_event.color) &&
      isString(value.button_event.pressed_at) &&
      isRecord(value.selected_choice) &&
      isButton(value.selected_choice.button) &&
      isString(value.selected_choice.label) &&
      isEvaluation(value.evaluation)
    );
  }

  if (responseType === "button_sequence") {
    if (value.input_mode !== "physical_button_sequence" && value.input_mode !== "touch_sequence") {
      return false;
    }
    return (
      Array.isArray(value.button_events) &&
      value.button_events.every(
        (event) =>
          isRecord(event) &&
          Number.isInteger(event.sequence_index) &&
          isButton(event.button) &&
          isString(event.choice_label) &&
          isString(event.pressed_at) &&
          isFiniteNonNegative(event.elapsed_ms_from_question),
      ) &&
      Array.isArray(value.submitted_sequence) &&
      value.submitted_sequence.every(isButton) &&
      Array.isArray(value.submitted_labels) &&
      value.submitted_labels.every(isString) &&
      isString(value.submitted_at) &&
      isEvaluation(value.evaluation)
    );
  }

  if (responseType !== "voice" || value.input_mode !== "voice") return false;
  return (
    isNullableString(value.recording_started_at) &&
    isNullableString(value.recording_ended_at) &&
    isFiniteNonNegative(value.audio_duration_seconds) &&
    isRecord(value.audio_storage) &&
    isString(value.audio_storage.object_key) &&
    isNullableString(value.audio_storage.mime_type) &&
    (isFiniteNonNegative(value.audio_storage.sample_rate_hz) || value.audio_storage.sample_rate_hz === null) &&
    (isFiniteNonNegative(value.audio_storage.channels) || value.audio_storage.channels === null) &&
    ["stored", "not_stored", "deleted"].includes(String(value.audio_storage.retention_status)) &&
    isNullableString(value.raw_user_utterance_transcript) &&
    isRecord(value.stt) &&
    isString(value.stt.engine) &&
    (value.stt.status === "completed" || value.stt.status === "failed") &&
    typeof value.stt.no_speech === "boolean" &&
    isNullableString(value.stt.transcript) &&
    Array.isArray(value.stt.segments) &&
    value.stt.segments.every(
      (segment) =>
        isRecord(segment) &&
        Number.isInteger(segment.id) &&
        isFiniteNonNegative(segment.start) &&
        isFiniteNonNegative(segment.end) &&
        segment.end >= segment.start &&
        isString(segment.text),
    ) &&
    isRecord(value.derived_annotations) &&
    (value.derived_annotations.status === "completed" || value.derived_annotations.status === "empty") &&
    Array.isArray(value.derived_annotations.items)
  );
}

function isQuestionRecord(value: unknown): value is HaruAdminQuestionRecord {
  if (!isRecord(value) || !isRecord(value.presentation) || !isRecord(value.question)) return false;
  const question = value.question;
  if (
    !isString(question.question_id) ||
    !Number.isInteger(question.order) ||
    !isString(question.domain) ||
    !["single_choice", "voice", "button_sequence"].includes(String(question.response_type)) ||
    !isString(question.prompt_text) ||
    !isString(question.prompt_audio_text) ||
    typeof question.scored !== "boolean"
  ) {
    return false;
  }
  if (
    !isString(value.presentation.presented_at) ||
    value.presentation.screen_state !== "question" ||
    !isNullableString(value.presentation.character_message)
  ) {
    return false;
  }
  if (!isResponse(value.response, question.response_type)) return false;
  return (
    value.system_feedback === null ||
    (isRecord(value.system_feedback) &&
      isString(value.system_feedback.feedback_text) &&
      isString(value.system_feedback.shown_at))
  );
}

function isSession(value: unknown): value is HaruAdminUsageSession {
  if (!isRecord(value) || !Array.isArray(value.question_records)) return false;
  if (
    !isString(value.session_id) ||
    !isString(value.user_id) ||
    !isString(value.device_id) ||
    !isString(value.session_date) ||
    !isString(value.weekday) ||
    !isString(value.session_started_at) ||
    !isNullableString(value.session_completed_at) ||
    !["in_progress", "completed", "abandoned"].includes(String(value.completion_status)) ||
    typeof value.question_count !== "number" ||
    !Number.isInteger(value.question_count) ||
    value.question_count < 0 ||
    !value.question_records.every(isQuestionRecord)
  ) {
    return false;
  }
  const questionIds = value.question_records.map((record) => record.question.question_id);
  return new Set(questionIds).size === questionIds.length;
}

export function parseHaruAdminUsageRecord(
  value: unknown,
  options: ParseOptions = {},
): HaruAdminUsageRecord | null {
  if (!isRecord(value) || !isRecord(value.schema) || !isRecord(value.user) || !isRecord(value.device)) {
    return null;
  }
  if (
    value.schema.name !== "haru_kiosk_usage_record" ||
    value.schema.version !== "1.0.0" ||
    !isString(value.user.user_id) ||
    !isString(value.device.device_id) ||
    (options.expectedUserId !== undefined && value.user.user_id !== options.expectedUserId) ||
    (options.expectedDeviceId !== undefined && value.device.device_id !== options.expectedDeviceId) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isSession)
  ) {
    return null;
  }

  const userId = value.user.user_id;
  const deviceId = value.device.device_id;
  const sessions = value.sessions as HaruAdminUsageSession[];
  const sessionIds = sessions.map((session) => session.session_id);
  const sessionDates = sessions.map((session) => session.session_date);
  if (new Set(sessionIds).size !== sessionIds.length || new Set(sessionDates).size !== sessionDates.length) {
    return null;
  }
  if (
    sessions.some(
      (session) =>
        session.user_id !== userId || session.device_id !== deviceId,
    )
  ) {
    return null;
  }
  return value as unknown as HaruAdminUsageRecord;
}
