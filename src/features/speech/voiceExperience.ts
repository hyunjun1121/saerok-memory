import type {
  TelemetryVoiceOutcomeReason,
  TelemetryWaveformMode,
  TelemetryVoiceExperienceVariant,
} from "@/features/analytics/types";

export const HARU_VOICE_EXPERIENCE = {
  voiceExperienceVariant: "assist_v2" as TelemetryVoiceExperienceVariant,
  waveformMode: "reactive_red" as TelemetryWaveformMode,
  guidanceCopyVersion: "voice-guidance-2026-08-v2",
  sttPipelineVersion: "haru-qwen3-asr-v2",
} as const;

const VOICE_OUTCOME_REASONS = new Set<TelemetryVoiceOutcomeReason>([
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

export function voiceOutcomeReason(value: unknown): TelemetryVoiceOutcomeReason | undefined {
  return typeof value === "string" && VOICE_OUTCOME_REASONS.has(value as TelemetryVoiceOutcomeReason)
    ? (value as TelemetryVoiceOutcomeReason)
    : undefined;
}

export function resolveVoiceOutcomeReason(input: {
  durationMs: number;
  recognitionError?: string | null;
  sttStatus?: "completed" | "failed";
  noSpeech?: boolean;
}): TelemetryVoiceOutcomeReason {
  switch (input.recognitionError) {
    case "mic-denied":
      return "permission_denied";
    case "voice-consent-required":
    case "stt-consent-required":
      return "consent_required";
    case "audio-unavailable":
      return "capture_failed";
    case "unsupported":
    case "recorder-unavailable":
      return "unsupported";
    case "stt-pending":
      return "stt_queued";
    case "no-speech":
      return "no_speech";
    case "cancelled":
      return "cancelled";
    case "stt-queue-failed":
    case "transcribe-failed":
      return "stt_failed";
  }
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) return "capture_failed";
  if (input.noSpeech) return "no_speech";
  if (input.sttStatus === "completed") return "completed";
  return "stt_failed";
}

const VERSION_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export function resolveSttPipelineVersion(preprocessingVersion?: string | null): string {
  const candidate = preprocessingVersion?.trim();
  return candidate && VERSION_CODE.test(candidate)
    ? candidate
    : HARU_VOICE_EXPERIENCE.sttPipelineVersion;
}
