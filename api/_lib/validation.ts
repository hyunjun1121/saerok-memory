import {
  DELETION_CATEGORIES,
  EXPORT_CATEGORIES,
  TELEMETRY_EVENT_NAMES,
  VOICE_EXPERIENCE_VARIANTS,
  VOICE_OUTCOME_REASONS,
  VOICE_WAVEFORM_MODES,
  type ActivitySessionState,
  type ConsentGrants,
  type DeletionCategory,
  type ExportCategory,
  type HaruMarket,
  type TelemetryEventName,
  type ValidatedActivitySession,
  type ValidatedQuestionAttempt,
  type ValidatedTelemetryEvent,
} from './contracts'

type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; tooLarge?: boolean }

const MAX_BATCH_EVENTS = 50
const MAX_BATCH_BYTES = 64 * 1024
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_ID_PATTERN = /^[\p{L}\p{N}_.:/-]{1,100}$/u
const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys)
  return Object.keys(record).every((key) => allowed.has(key))
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value)
}

function isVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value)
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 20 &&
    value.length <= 35 &&
    Number.isFinite(Date.parse(value))
  )
}

function isBoundedInteger(value: unknown, maximum: number) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= maximum
}

function serializedByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

const EVENT_KEYS = [
  'schemaVersion',
  'eventId',
  'eventName',
  'occurredAt',
  'sequence',
  'appVersion',
  'contentPackVersion',
  'installationId',
  'visitId',
  'routineSessionId',
  'questionInstanceId',
  'routeId',
  'consentRevision',
  'payload',
] as const

const EVENT_ID_PATTERN = /^evt_(kr|jp)_[a-f0-9]{32}$/
const INSTALLATION_ID_PATTERN = /^inst_(kr|jp)_[a-f0-9]{32}$/
const VISIT_ID_PATTERN = /^visit_[a-f0-9]{32}$/
const ROUTINE_ID_PATTERN = /^routine_[a-f0-9]{32}$/
const QUESTION_ID_PATTERN = /^question_[a-f0-9]{32}$/
const TELEMETRY_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const ROUTE_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]{0,255}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^(?:\+?\d{1,3}[- .]?)?(?:\d{2,4}[- .]?){2,4}\d{3,4}$/

type PayloadValidator = (value: unknown) => boolean
interface PayloadSchema {
  required: Record<string, PayloadValidator>
  optional?: Record<string, PayloadValidator>
}

function telemetryToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    TELEMETRY_TOKEN_PATTERN.test(value) &&
    !EMAIL_PATTERN.test(value) &&
    !(value.length >= 8 && PHONE_PATTERN.test(value))
  )
}

const booleanValue: PayloadValidator = (value) => typeof value === 'boolean'
const count: PayloadValidator = (value) => isBoundedInteger(value, 1_000_000)
const duration: PayloadValidator = (value) => isBoundedInteger(value, MAX_DURATION_MS)
const metric: PayloadValidator = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12
const token: PayloadValidator = telemetryToken
const tokenArray: PayloadValidator = (value) =>
  Array.isArray(value) && value.length <= 32 && value.every(telemetryToken)
const oneOf = (...allowed: readonly string[]): PayloadValidator =>
  (value) => typeof value === 'string' && allowed.includes(value)

const TELEMETRY_PAYLOAD_SCHEMAS: Record<TelemetryEventName, PayloadSchema> = {
  app_opened: { required: { launchKind: oneOf('fresh', 'returning', 'resume'), online: booleanValue } },
  route_viewed: { required: { navigationKind: oneOf('initial', 'push', 'replace', 'history') } },
  app_visibility_changed: { required: { visibility: oneOf('visible', 'hidden') } },
  network_changed: { required: { state: oneOf('online', 'offline') } },
  onboarding_step: { required: { stepId: token, state: oneOf('shown', 'completed', 'abandoned') } },
  consent_changed: {
    required: {
      category: oneOf('usage_analytics', 'longitudinal_activity', 'voice_capture', 'stt_processing', 'transcript_storage', 'audio_storage', 'personalization', 'family_sharing'),
      granted: booleanValue,
      source: oneOf('onboarding', 'settings', 'withdrawal'),
    },
  },
  setting_changed: { required: { settingId: token, valueCode: token } },
  routine_started: { required: { routineId: token, dayIndex: count } },
  routine_paused: { required: { reason: oneOf('user', 'background', 'idle') } },
  routine_resumed: { required: { resumeKind: oneOf('same_session', 'after_dropoff') } },
  session_exit_observed: { required: { reason: oneOf('pagehide', 'reload', 'close', 'route_change', 'unknown') } },
  routine_completed: { required: { questionCount: count, activeDurationMs: duration, wallDurationMs: duration } },
  question_presented: {
    required: {
      questionId: token,
      exerciseType: token,
      domain: token,
      ordinal: count,
      difficulty: token,
      questionContentVersion: token,
      questionContentHash: token,
    },
    optional: {
      voiceExperienceVariant: oneOf(...VOICE_EXPERIENCE_VARIANTS),
      waveformMode: oneOf(...VOICE_WAVEFORM_MODES),
      guidanceCopyVersion: token,
      sttPipelineVersion: token,
    },
  },
  question_first_interaction: { required: { inputMode: oneOf('touch', 'key_action', 'voice', 'pointer'), latencyMs: duration } },
  choice_changed: {
    required: {
      actionId: token,
      selectionState: oneOf('selected', 'deselected'),
      selectionCount: count,
      changeIndex: count,
    },
  },
  sequence_changed: { required: { action: oneOf('add', 'remove', 'reorder'), itemId: token, position: count, itemCount: count } },
  pair_attempted: { required: { leftId: token, rightId: token, matched: booleanValue, attempt: count, latencyMs: duration } },
  answer_confirmed: {
    required: {
      inputMode: oneOf('touch', 'key_action', 'voice', 'pointer'),
      responseIds: tokenArray,
      result: oneOf('correct', 'incorrect', 'unscored'),
      responseTimeMs: duration,
      activeResponseTimeMs: duration,
      selectionChangeCount: count,
    },
  },
  feedback_shown: { required: { kind: oneOf('success', 'retry', 'neutral') } },
  hint_used: { required: { hintId: token, attempt: count } },
  retry_started: { required: { attempt: count } },
  question_skipped: { required: { reason: oneOf('user', 'timeout', 'unsupported', 'permission_denied') } },
  question_completed: { required: { attemptCount: count, activeDurationMs: duration, wallDurationMs: duration, feedbackDurationMs: duration } },
  audio_played: { required: { assetId: token, action: oneOf('play', 'replay'), status: oneOf('started', 'completed', 'failed') } },
  voice_capture_status: {
    required: { phase: oneOf('permission', 'started', 'cancelled', 'completed', 'failed') },
    optional: {
      permission: oneOf('granted', 'denied', 'unavailable'),
      durationMs: duration,
      sttStatus: oneOf('not_requested', 'queued', 'completed', 'no_speech', 'failed'),
      sttLatencyMs: duration,
      noSpeech: booleanValue,
      voiceExperienceVariant: oneOf(...VOICE_EXPERIENCE_VARIANTS),
      waveformMode: oneOf(...VOICE_WAVEFORM_MODES),
      guidanceCopyVersion: token,
      sttPipelineVersion: token,
      outcomeReason: oneOf(...VOICE_OUTCOME_REASONS),
    },
  },
  drawing_progress: { required: { phase: oneOf('started', 'completed', 'cleared'), strokeCount: count, pointCount: count, pauseCount: count, eraseCount: count, durationMs: duration } },
  reward_earned: { required: { rewardId: token, rewardKind: token } },
  pairing_status: { required: { role: oneOf('caregiver', 'counselor'), state: oneOf('issued', 'redeemed', 'expired', 'revoked', 'failed') } },
  caregiver_observation_submitted: { required: { domainCount: count, shared: booleanValue } },
  report_viewed: { required: { reportId: token, role: oneOf('caregiver', 'counselor') }, optional: { sectionId: token } },
  share_changed: { required: { scope: oneOf('activity', 'memory', 'observation', 'report'), granted: booleanValue } },
  export_requested: { required: { scope: oneOf('all', 'profile', 'activity', 'memory', 'analytics') } },
  deletion_requested: { required: { scope: oneOf('all', 'profile', 'activity', 'memory', 'analytics', 'audio') } },
  permission_result: { required: { permission: oneOf('microphone', 'notifications', 'storage'), state: oneOf('granted', 'denied', 'unavailable') } },
  sync_status: {
    required: { target: oneOf('telemetry', 'activity', 'stt', 'rag'), state: oneOf('queued', 'sending', 'completed', 'retrying', 'failed') },
    optional: { statusCode: (value) => isBoundedInteger(value, 599) && Number(value) >= 100, attempt: count, latencyMs: duration },
  },
  client_error: { required: { source: token, code: token, recoverable: booleanValue } },
  performance_measured: { required: { metric: oneOf('lcp', 'inp', 'cls', 'api_latency', 'render_latency'), value: metric } },
}

function validTelemetryPayload(eventName: TelemetryEventName, value: unknown) {
  if (!isRecord(value)) return false
  const schema = TELEMETRY_PAYLOAD_SCHEMAS[eventName]
  const allowed = { ...schema.required, ...(schema.optional ?? {}) }
  return (
    hasOnlyKeys(value, Object.keys(allowed)) &&
    Object.entries(schema.required).every(
      ([field, validator]) => field in value && validator(value[field]),
    ) &&
    Object.entries(schema.optional ?? {}).every(
      ([field, validator]) => !(field in value) || validator(value[field]),
    )
  )
}

function validateTelemetryEvent(
  value: unknown,
  market: HaruMarket,
): Validation<ValidatedTelemetryEvent> {
  if (!isRecord(value)) return { ok: false, error: 'invalid_event' }
  if ('market' in value || 'locale' in value) {
    return { ok: false, error: 'client_market_forbidden' }
  }
  if (!hasOnlyKeys(value, EVENT_KEYS)) return { ok: false, error: 'invalid_event' }
  const eventName = value.eventName as TelemetryEventName
  if (
    value.schemaVersion !== '1.0' ||
    typeof value.eventId !== 'string' ||
    !EVENT_ID_PATTERN.test(value.eventId) ||
    !value.eventId.startsWith(`evt_${market}_`) ||
    !TELEMETRY_EVENT_NAMES.includes(eventName) ||
    !isIsoDate(value.occurredAt) ||
    !isBoundedInteger(value.sequence, 1_000_000_000) ||
    !telemetryToken(value.appVersion) ||
    !telemetryToken(value.contentPackVersion) ||
    typeof value.installationId !== 'string' ||
    !INSTALLATION_ID_PATTERN.test(value.installationId) ||
    !value.installationId.startsWith(`inst_${market}_`) ||
    typeof value.visitId !== 'string' ||
    !VISIT_ID_PATTERN.test(value.visitId) ||
    (value.routineSessionId !== undefined && !telemetryToken(value.routineSessionId)) ||
    (value.questionInstanceId !== undefined && !telemetryToken(value.questionInstanceId)) ||
    typeof value.routeId !== 'string' ||
    !ROUTE_PATTERN.test(value.routeId) ||
    !telemetryToken(value.consentRevision)
  ) {
    return { ok: false, error: 'invalid_event' }
  }
  if (!validTelemetryPayload(eventName, value.payload)) {
    return { ok: false, error: 'invalid_event_payload' }
  }
  return { ok: true, value: value as unknown as ValidatedTelemetryEvent }
}

export function validateTelemetryBatch(
  value: unknown,
  market: HaruMarket,
): Validation<ValidatedTelemetryEvent[]> {
  if (serializedByteLength(value) > MAX_BATCH_BYTES) {
    return { ok: false, error: 'batch_too_large', tooLarge: true }
  }
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['schemaVersion', 'events']) ||
    value.schemaVersion !== '1.0' ||
    !Array.isArray(value.events)
  ) {
    return { ok: false, error: 'invalid_batch' }
  }
  if (value.events.length === 0) return { ok: false, error: 'invalid_batch' }
  if (value.events.length > MAX_BATCH_EVENTS) {
    return { ok: false, error: 'batch_too_large', tooLarge: true }
  }
  const events: ValidatedTelemetryEvent[] = []
  for (const event of value.events) {
    const checked = validateTelemetryEvent(event, market)
    if (!checked.ok) return checked
    events.push(checked.value)
  }
  return { ok: true, value: events }
}

const SESSION_STATES: ActivitySessionState[] = [
  'started',
  'paused',
  'resumed',
  'exit_observed',
  'completed',
]

export function validateActivitySession(value: unknown): Validation<ValidatedActivitySession> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'sessionId',
      'state',
      'occurredAt',
      'contentPackVersion',
      'consentRevision',
      'progressPercent',
      'activeDurationMs',
      'wallDurationMs',
      'lastQuestionInstanceId',
    ]) ||
    typeof value.sessionId !== 'string' ||
    !ROUTINE_ID_PATTERN.test(value.sessionId) ||
    !SESSION_STATES.includes(value.state as ActivitySessionState) ||
    !isIsoDate(value.occurredAt) ||
    !isVersion(value.contentPackVersion) ||
    !isSafeId(value.consentRevision) ||
    typeof value.progressPercent !== 'number' ||
    value.progressPercent < 0 ||
    value.progressPercent > 100 ||
    !isBoundedInteger(value.activeDurationMs, MAX_DURATION_MS) ||
    !isBoundedInteger(value.wallDurationMs, MAX_DURATION_MS) ||
    Number(value.activeDurationMs) > Number(value.wallDurationMs) ||
    (value.lastQuestionInstanceId !== undefined &&
      (typeof value.lastQuestionInstanceId !== 'string' ||
        !QUESTION_ID_PATTERN.test(value.lastQuestionInstanceId)))
  ) {
    return { ok: false, error: 'invalid_activity_session' }
  }
  return { ok: true, value: value as unknown as ValidatedActivitySession }
}

const ATTEMPT_KEYS = [
  'sessionId',
  'questionInstanceId',
  'questionId',
  'questionType',
  'contentPackVersion',
  'presentedAt',
  'completedAt',
  'activeDurationMs',
  'wallDurationMs',
  'firstInteractionMs',
  'confirmationLatencyMs',
  'response',
] as const

const RESPONSE_KEYS = [
  'selectedOptionIds',
  'sequenceIds',
  'isCorrect',
  'isValid',
  'retryCount',
  'hintCount',
  'skipReason',
] as const

function optionalDuration(value: unknown) {
  return value === undefined || isBoundedInteger(value, MAX_DURATION_MS)
}

function optionalIdArray(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) && value.length <= 16 && value.every(isSafeId))
  )
}

function validAttemptResponse(value: unknown) {
  if (value === undefined) return true
  if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)) return false
  return (
    optionalIdArray(value.selectedOptionIds) &&
    optionalIdArray(value.sequenceIds) &&
    (value.isCorrect === undefined || typeof value.isCorrect === 'boolean') &&
    (value.isValid === undefined || typeof value.isValid === 'boolean') &&
    (value.retryCount === undefined || isBoundedInteger(value.retryCount, 100)) &&
    (value.hintCount === undefined || isBoundedInteger(value.hintCount, 100)) &&
    (value.skipReason === undefined || isSafeId(value.skipReason))
  )
}

export function validateQuestionAttempt(value: unknown): Validation<ValidatedQuestionAttempt> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ATTEMPT_KEYS) ||
    typeof value.sessionId !== 'string' ||
    !ROUTINE_ID_PATTERN.test(value.sessionId) ||
    typeof value.questionInstanceId !== 'string' ||
    !QUESTION_ID_PATTERN.test(value.questionInstanceId) ||
    !isSafeId(value.questionId) ||
    !isSafeId(value.questionType) ||
    !isVersion(value.contentPackVersion) ||
    !isIsoDate(value.presentedAt) ||
    (value.completedAt !== undefined && !isIsoDate(value.completedAt)) ||
    !isBoundedInteger(value.activeDurationMs, MAX_DURATION_MS) ||
    !isBoundedInteger(value.wallDurationMs, MAX_DURATION_MS) ||
    Number(value.activeDurationMs) > Number(value.wallDurationMs) ||
    !optionalDuration(value.firstInteractionMs) ||
    !optionalDuration(value.confirmationLatencyMs) ||
    !validAttemptResponse(value.response)
  ) {
    return { ok: false, error: 'invalid_question_attempt' }
  }
  return { ok: true, value: value as unknown as ValidatedQuestionAttempt }
}

function validateCategories<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= allowed.length &&
    new Set(value).size === value.length &&
    value.every((entry) => typeof entry === 'string' && allowed.includes(entry as T))
  )
}

export function validatePrivacyExport(value: unknown): Validation<{
  format: 'json'
  categories: ExportCategory[]
}> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['format', 'categories']) ||
    value.format !== 'json' ||
    !validateCategories(value.categories, EXPORT_CATEGORIES)
  ) {
    return { ok: false, error: 'invalid_export_request' }
  }
  return {
    ok: true,
    value: { format: 'json', categories: value.categories },
  }
}

export function validatePrivacyDeletion(value: unknown): Validation<{
  requestId: string
  categories: DeletionCategory[]
}> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['requestId', 'categories']) ||
    !isUuid(value.requestId) ||
    !validateCategories(value.categories, DELETION_CATEGORIES) ||
    (value.categories.includes('all') && value.categories.length !== 1)
  ) {
    return { ok: false, error: 'invalid_deletion_request' }
  }
  return {
    ok: true,
    value: { requestId: value.requestId, categories: value.categories },
  }
}

export function validateEnrollment(value: unknown, market: HaruMarket): Validation<{
  code: string
  installationId: string
  consentRevision: string
}> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['code', 'installationId', 'consentRevision'])) {
    return { ok: false, error: 'invalid_enrollment_request' }
  }
  const code = typeof value.code === 'string' ? value.code.trim().toUpperCase() : ''
  if (
    !/^[A-Z2-9]{8}$/.test(code) ||
    typeof value.installationId !== 'string' ||
    !INSTALLATION_ID_PATTERN.test(value.installationId) ||
    !value.installationId.startsWith(`inst_${market}_`) ||
    !isSafeId(value.consentRevision)
  ) {
    return { ok: false, error: 'invalid_enrollment_request' }
  }
  return {
    ok: true,
    value: {
      code,
      installationId: value.installationId,
      consentRevision: value.consentRevision,
    },
  }
}

export function validateEnrollmentCodeIssue(value: unknown): Validation<{
  expiresInMinutes: number
}> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['expiresInMinutes'])) {
    return { ok: false, error: 'invalid_enrollment_code_request' }
  }
  const expiresInMinutes = value.expiresInMinutes ?? 24 * 60
  if (
    !Number.isInteger(expiresInMinutes) ||
    Number(expiresInMinutes) < 5 ||
    Number(expiresInMinutes) > 7 * 24 * 60
  ) {
    return { ok: false, error: 'invalid_enrollment_code_request' }
  }
  return {
    ok: true,
    value: { expiresInMinutes: Number(expiresInMinutes) },
  }
}

const CONSENT_GRANT_KEYS = [
  'usageAnalytics',
  'longitudinalActivity',
  'voiceCapture',
  'sttProcessing',
  'transcriptStorage',
  'audioStorage',
  'personalization',
  'familySharing',
] as const

export function validateConsentReceipt(value: unknown): Validation<{
  revision: string
  occurredAt: string
  grants: ConsentGrants
}> {
  if (!isRecord(value) || !isRecord(value.grants)) {
    return { ok: false, error: 'invalid_consent_receipt' }
  }
  const grants = value.grants
  if (
    !hasOnlyKeys(value, ['revision', 'occurredAt', 'grants']) ||
    !isSafeId(value.revision) ||
    !isIsoDate(value.occurredAt) ||
    !hasOnlyKeys(grants, CONSENT_GRANT_KEYS) ||
    Object.keys(grants).length !== CONSENT_GRANT_KEYS.length ||
    !CONSENT_GRANT_KEYS.every((key) => typeof grants[key] === 'boolean')
  ) return { ok: false, error: 'invalid_consent_receipt' }
  return {
    ok: true,
    value: {
      revision: value.revision,
      occurredAt: value.occurredAt,
      grants: grants as unknown as ConsentGrants,
    },
  }
}

export { isUuid }
