import {
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryEnvelope,
  type TelemetryEventName,
} from "@/features/analytics/types";

export type TelemetryValidationResult =
  | { ok: true; event: TelemetryEnvelope }
  | { ok: false; reason: string };

const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "eventId",
  "occurredAt",
  "sequence",
  "market",
  "locale",
  "appVersion",
  "contentPackVersion",
  "installationId",
  "visitId",
  "routineSessionId",
  "questionInstanceId",
  "routeId",
  "consentRevision",
  "eventName",
  "payload",
]);

const PAYLOAD_FIELDS = {
  app_opened: ["launchKind", "online"],
  route_viewed: ["navigationKind"],
  app_visibility_changed: ["visibility"],
  network_changed: ["state"],
  onboarding_step: ["stepId", "state"],
  consent_changed: ["category", "granted", "source"],
  setting_changed: ["settingId", "valueCode"],
  routine_started: ["routineId", "dayIndex"],
  routine_paused: ["reason"],
  routine_resumed: ["resumeKind"],
  session_exit_observed: ["reason"],
  routine_completed: ["questionCount", "activeDurationMs", "wallDurationMs"],
  question_presented: [
    "questionId",
    "exerciseType",
    "domain",
    "ordinal",
    "difficulty",
    "questionContentVersion",
    "questionContentHash",
    "voiceExperienceVariant",
    "waveformMode",
    "guidanceCopyVersion",
    "sttPipelineVersion",
  ],
  question_first_interaction: ["inputMode", "latencyMs"],
  choice_changed: ["actionId", "selectionState", "selectionCount", "changeIndex"],
  sequence_changed: ["action", "itemId", "position", "itemCount"],
  pair_attempted: ["leftId", "rightId", "matched", "attempt", "latencyMs"],
  answer_confirmed: [
    "inputMode",
    "responseIds",
    "result",
    "responseTimeMs",
    "activeResponseTimeMs",
    "selectionChangeCount",
  ],
  feedback_shown: ["kind"],
  hint_used: ["hintId", "attempt"],
  retry_started: ["attempt"],
  question_skipped: ["reason"],
  question_completed: [
    "attemptCount",
    "activeDurationMs",
    "wallDurationMs",
    "feedbackDurationMs",
  ],
  audio_played: ["assetId", "action", "status"],
  voice_capture_status: [
    "phase",
    "permission",
    "durationMs",
    "sttStatus",
    "sttLatencyMs",
    "noSpeech",
    "voiceExperienceVariant",
    "waveformMode",
    "guidanceCopyVersion",
    "sttPipelineVersion",
    "outcomeReason",
  ],
  drawing_progress: [
    "phase",
    "strokeCount",
    "pointCount",
    "pauseCount",
    "eraseCount",
    "durationMs",
  ],
  reward_earned: ["rewardId", "rewardKind"],
  pairing_status: ["role", "state"],
  caregiver_observation_submitted: ["domainCount", "shared"],
  report_viewed: ["reportId", "role", "sectionId"],
  share_changed: ["scope", "granted"],
  export_requested: ["scope"],
  deletion_requested: ["scope"],
  permission_result: ["permission", "state"],
  sync_status: ["target", "state", "statusCode", "attempt", "latencyMs"],
  client_error: ["source", "code", "recoverable"],
  performance_measured: ["metric", "value"],
} as const satisfies Record<TelemetryEventName, readonly string[]>;

const OPTIONAL_PAYLOAD_FIELDS: Partial<Record<TelemetryEventName, ReadonlySet<string>>> = {
  question_presented: new Set([
    "voiceExperienceVariant",
    "waveformMode",
    "guidanceCopyVersion",
    "sttPipelineVersion",
  ]),
  voice_capture_status: new Set([
    "permission",
    "durationMs",
    "sttStatus",
    "sttLatencyMs",
    "noSpeech",
    "voiceExperienceVariant",
    "waveformMode",
    "guidanceCopyVersion",
    "sttPipelineVersion",
    "outcomeReason",
  ]),
  report_viewed: new Set(["sectionId"]),
  sync_status: new Set(["statusCode", "attempt", "latencyMs"]),
};

const VOICE_EXPERIENCE_VARIANTS = new Set(["baseline_v1", "assist_v2"]);
const VOICE_WAVEFORM_MODES = new Set(["none", "reactive_red"]);
const VOICE_OUTCOME_REASONS = new Set([
  "completed",
  "no_speech",
  "permission_denied",
  "consent_required",
  "unsupported",
  "capture_failed",
  "stt_queued",
  "stt_failed",
  "cancelled",
]);

const SENSITIVE_FIELD_NAMES = new Set([
  "name",
  "fullname",
  "email",
  "phone",
  "phonenumber",
  "address",
  "transcript",
  "prompt",
  "choicelabel",
  "answertext",
  "freetext",
  "note",
  "story",
  "audioblob",
  "audiodata",
  "audiobytes",
  "recording",
  "coordinate",
  "coordinates",
  "latitude",
  "longitude",
  "rawuseragent",
  "useragent",
  "ipaddress",
]);

const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const EVENT_ID_PATTERN = /^evt_(kr|jp)_[a-f0-9]{32}$/;
const INSTALLATION_ID_PATTERN = /^inst_(kr|jp)_[a-f0-9]{32}$/;
const VISIT_ID_PATTERN = /^visit_[a-f0-9]{32}$/;
const ROUTE_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,255}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:\+?\d{1,3}[- .]?)?(?:\d{2,4}[- .]?){2,4}\d{3,4}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveField(field: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(field.toLowerCase().replace(/[_-]/g, ""));
}

function findSensitiveField(value: unknown, path = "event"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSensitiveField(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveField(key)) return `${path}.${key}`;
    const found = findSensitiveField(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function isSafeToken(value: string): boolean {
  return (
    SAFE_TOKEN_PATTERN.test(value) &&
    !EMAIL_PATTERN.test(value) &&
    !(value.length >= 8 && PHONE_PATTERN.test(value))
  );
}

function isSafePayloadValue(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value === "string") return isSafeToken(value);
  if (Array.isArray(value)) {
    return value.length <= 32 && value.every((item) => typeof item === "string" && isSafeToken(item));
  }
  return false;
}

function validateCommonFields(event: Record<string, unknown>): string | null {
  for (const field of Object.keys(event)) {
    if (!TOP_LEVEL_FIELDS.has(field)) return `event.${field} is not allowlisted`;
  }
  for (const required of TOP_LEVEL_FIELDS) {
    if (required === "routineSessionId" || required === "questionInstanceId") continue;
    if (!(required in event)) return `event.${required} is required`;
  }
  if (event.schemaVersion !== TELEMETRY_SCHEMA_VERSION) return "event.schemaVersion is unsupported";
  if (typeof event.eventId !== "string" || !EVENT_ID_PATTERN.test(event.eventId)) {
    return "event.eventId is invalid";
  }
  if (typeof event.installationId !== "string" || !INSTALLATION_ID_PATTERN.test(event.installationId)) {
    return "event.installationId is invalid";
  }
  if (typeof event.visitId !== "string" || !VISIT_ID_PATTERN.test(event.visitId)) {
    return "event.visitId is invalid";
  }
  if (event.market !== "kr" && event.market !== "jp") return "event.market is invalid";
  const expectedLocale = event.market === "kr" ? "ko-KR" : "ja-JP";
  if (event.locale !== expectedLocale) return "event.locale does not match market";
  if (
    typeof event.occurredAt !== "string" ||
    !event.occurredAt.includes("T") ||
    Number.isNaN(Date.parse(event.occurredAt))
  ) {
    return "event.occurredAt is invalid";
  }
  if (!Number.isSafeInteger(event.sequence) || (event.sequence as number) < 0) {
    return "event.sequence is invalid";
  }
  if (typeof event.routeId !== "string" || !ROUTE_PATTERN.test(event.routeId)) {
    return "event.routeId is invalid";
  }
  for (const field of [
    "appVersion",
    "contentPackVersion",
    "consentRevision",
    "routineSessionId",
    "questionInstanceId",
  ]) {
    const value = event[field];
    if (value !== undefined && (typeof value !== "string" || !isSafeToken(value))) {
      return `event.${field} is invalid`;
    }
  }
  const market = event.market as "kr" | "jp";
  if (!event.eventId.startsWith(`evt_${market}_`)) return "event.eventId does not match market";
  if (!event.installationId.startsWith(`inst_${market}_`)) {
    return "event.installationId does not match market";
  }
  return null;
}

export function validateTelemetryEnvelope(input: unknown): TelemetryValidationResult {
  if (!isRecord(input)) return { ok: false, reason: "event must be an object" };

  const sensitivePath = findSensitiveField(input);
  if (sensitivePath) return { ok: false, reason: `${sensitivePath} contains a prohibited field` };

  const commonError = validateCommonFields(input);
  if (commonError) return { ok: false, reason: commonError };

  const eventName = input.eventName;
  if (typeof eventName !== "string" || !(eventName in PAYLOAD_FIELDS)) {
    return { ok: false, reason: "event.eventName is not allowlisted" };
  }
  if (!isRecord(input.payload)) return { ok: false, reason: "event.payload must be an object" };

  const typedEventName = eventName as TelemetryEventName;
  const allowedFields = new Set<string>(PAYLOAD_FIELDS[typedEventName]);
  const optionalFields = OPTIONAL_PAYLOAD_FIELDS[typedEventName] ?? new Set<string>();
  for (const field of Object.keys(input.payload)) {
    if (!allowedFields.has(field)) {
      return { ok: false, reason: `event.payload.${field} is not allowlisted` };
    }
  }
  for (const required of allowedFields) {
    if (!optionalFields.has(required) && !(required in input.payload)) {
      return { ok: false, reason: `event.payload.${required} is required` };
    }
  }
  for (const [field, value] of Object.entries(input.payload)) {
    if (value !== undefined && !isSafePayloadValue(value)) {
      return { ok: false, reason: `event.payload.${field} contains free text or an invalid value` };
    }
  }
  if (
    typedEventName === "voice_capture_status" ||
    typedEventName === "question_presented"
  ) {
    const variant = input.payload.voiceExperienceVariant;
    const waveform = input.payload.waveformMode;
    if (variant !== undefined && !VOICE_EXPERIENCE_VARIANTS.has(String(variant))) {
      return { ok: false, reason: "event.payload.voiceExperienceVariant is invalid" };
    }
    if (waveform !== undefined && !VOICE_WAVEFORM_MODES.has(String(waveform))) {
      return { ok: false, reason: "event.payload.waveformMode is invalid" };
    }
    if (typedEventName === "voice_capture_status") {
      const outcome = input.payload.outcomeReason;
      if (outcome !== undefined && !VOICE_OUTCOME_REASONS.has(String(outcome))) {
        return { ok: false, reason: "event.payload.outcomeReason is invalid" };
      }
    }
  }

  return { ok: true, event: input as unknown as TelemetryEnvelope };
}

function shouldRedactString(value: string): boolean {
  return EMAIL_PATTERN.test(value) || (value.length >= 8 && PHONE_PATTERN.test(value));
}

export function redactTelemetryDiagnostic(input: unknown): unknown {
  if (typeof input === "string") return shouldRedactString(input) ? "[REDACTED]" : input;
  if (Array.isArray(input)) return input.map((item) => redactTelemetryDiagnostic(item));
  if (!isRecord(input)) return input;

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      isSensitiveField(key) ? "[REDACTED]" : redactTelemetryDiagnostic(value),
    ]),
  );
}
