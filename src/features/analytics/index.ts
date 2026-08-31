export {
  DEFAULT_IDLE_AFTER_MS,
  createActiveClock,
  readActiveClock,
  reduceActiveClock,
  type ActiveClockEvent,
  type ActiveClockSnapshot,
  type ActiveClockState,
} from "@/features/analytics/activeClock";
export {
  TelemetryBatchClient,
  TelemetryTransportError,
  createFetchTelemetryTransport,
  type TelemetryBatchTransport,
  type TelemetryBatchTransportResult,
  type TelemetryFlushResult,
} from "@/features/analytics/batchClient";
export {
  createEventId,
  createRandomIdentity,
  createRoutineSessionId,
  createVisitId,
  getOrCreateInstallationId,
  type IdentityStorage,
  type RandomIdentitySource,
} from "@/features/analytics/identity";
export {
  TELEMETRY_BATCH_MAX_BYTES,
  TELEMETRY_BATCH_MAX_EVENTS,
  TELEMETRY_OUTBOX_MAX_COUNT,
  TELEMETRY_OUTBOX_RETENTION_MS,
  IndexedDbOutboxStore,
  MemoryOutboxStore,
  TelemetryOutbox,
  createTelemetryOutbox,
  getTelemetryRetryDelayMs,
  type TelemetryOutboxOptions,
  type TelemetryOutboxRecord,
  type TelemetryOutboxStore,
} from "@/features/analytics/outbox";
export {
  redactTelemetryDiagnostic,
  validateTelemetryEnvelope,
  type TelemetryValidationResult,
} from "@/features/analytics/privacy";
export {
  DEFAULT_SESSION_STALE_AFTER_MS,
  createEmptySessionLifecycle,
  isSessionStale,
  transitionSessionLifecycle,
  type SessionLifecycleEffect,
  type SessionLifecycleEvent,
  type SessionLifecycleState,
  type SessionLifecycleTransition,
} from "@/features/analytics/sessionLifecycle";
export {
  HaruTelemetryRuntime,
  type HaruTelemetryRuntimeOptions,
  type TelemetryCaptureContext,
} from "@/features/analytics/runtime";
export {
  HaruLessonTelemetryTracker,
  type ConfirmedAnswerTelemetry,
  type HaruLessonTelemetryTrackerOptions,
  type HaruQuestionTelemetryMeta,
} from "@/features/analytics/lessonTracker";
export {
  captureHaruTelemetry,
  clearHaruTelemetry,
  createHaruLessonTelemetryTracker,
  flushHaruTelemetry,
  getPendingHaruTelemetryEvents,
  hashTelemetryContent,
  recordHaruRouteView,
  startHaruTelemetry,
  stopHaruTelemetry,
} from "@/features/analytics/client";
export {
  TELEMETRY_SCHEMA_VERSION,
  createTelemetryEnvelope,
  getTelemetryDataClass,
  type TelemetryCommonFields,
  type TelemetryConsentCategory,
  type TelemetryDataClass,
  type TelemetryEnvelope,
  type TelemetryEventInput,
  type TelemetryEventName,
  type TelemetryInputMode,
  type TelemetryLocale,
  type TelemetryMarket,
  type TelemetryPayloadMap,
} from "@/features/analytics/types";
