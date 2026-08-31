export type HaruMarket = 'kr' | 'jp'
export type HaruLocale = 'ko-KR' | 'ja-JP'

export const VOICE_EXPERIENCE_VARIANTS = ['baseline_v1', 'assist_v2'] as const
export const VOICE_WAVEFORM_MODES = ['none', 'reactive_red'] as const
export const VOICE_OUTCOME_REASONS = [
  'completed',
  'no_speech',
  'permission_denied',
  'consent_required',
  'unsupported',
  'capture_failed',
  'stt_queued',
  'stt_failed',
  'cancelled',
] as const

export const TELEMETRY_EVENT_NAMES = [
  'app_opened',
  'route_viewed',
  'app_visibility_changed',
  'network_changed',
  'onboarding_step',
  'consent_changed',
  'setting_changed',
  'routine_started',
  'routine_paused',
  'routine_resumed',
  'session_exit_observed',
  'routine_completed',
  'question_presented',
  'question_first_interaction',
  'choice_changed',
  'sequence_changed',
  'pair_attempted',
  'answer_confirmed',
  'feedback_shown',
  'hint_used',
  'retry_started',
  'question_skipped',
  'question_completed',
  'audio_played',
  'voice_capture_status',
  'drawing_progress',
  'reward_earned',
  'pairing_status',
  'caregiver_observation_submitted',
  'sync_status',
  'client_error',
  'report_viewed',
  'share_changed',
  'export_requested',
  'deletion_requested',
  'permission_result',
  'performance_measured',
] as const

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number]

export interface ValidatedTelemetryEvent {
  schemaVersion: '1.0'
  eventId: string
  eventName: TelemetryEventName
  occurredAt: string
  sequence: number
  appVersion: string
  contentPackVersion: string
  installationId: string
  visitId: string
  routineSessionId?: string
  questionInstanceId?: string
  routeId: string
  consentRevision: string
  payload: Record<string, string | number | boolean | string[] | null>
}

export type ActivitySessionState =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'exit_observed'
  | 'completed'

export interface ValidatedActivitySession {
  sessionId: string
  state: ActivitySessionState
  occurredAt: string
  contentPackVersion: string
  consentRevision: string
  progressPercent: number
  activeDurationMs: number
  wallDurationMs: number
  lastQuestionInstanceId?: string
}

export interface ValidatedQuestionAttempt {
  sessionId: string
  questionInstanceId: string
  questionId: string
  questionType: string
  contentPackVersion: string
  presentedAt: string
  completedAt?: string
  activeDurationMs: number
  wallDurationMs: number
  firstInteractionMs?: number
  confirmationLatencyMs?: number
  response?: {
    selectedOptionIds?: string[]
    sequenceIds?: string[]
    isCorrect?: boolean
    isValid?: boolean
    retryCount?: number
    hintCount?: number
    skipReason?: string
  }
}

export const EXPORT_CATEGORIES = [
  'profile',
  'consents',
  'sessions',
  'attempts',
  'memory',
  'caregiver',
  'telemetry',
] as const

export type ExportCategory = (typeof EXPORT_CATEGORIES)[number]

export const DELETION_CATEGORIES = [
  'profile',
  'activity',
  'memory',
  'voice',
  'caregiver',
  'telemetry',
  'all',
] as const

export type DeletionCategory = (typeof DELETION_CATEGORIES)[number]
export type DeletionStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ConsentGrants {
  usageAnalytics: boolean
  longitudinalActivity: boolean
  voiceCapture: boolean
  sttProcessing: boolean
  transcriptStorage: boolean
  audioStorage: boolean
  personalization: boolean
  familySharing: boolean
}
