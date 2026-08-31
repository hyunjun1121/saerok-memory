import { useSyncExternalStore } from "react";
import {
  getHaruConsent,
  subscribeToHaruConsent,
  type HaruConsentState,
} from "@/features/profile/haruConsentStorage";

function getConsentSnapshot(): string {
  return JSON.stringify(getHaruConsent());
}

function subscribe(onStoreChange: () => void): () => void {
  return subscribeToHaruConsent(() => onStoreChange());
}

export function useHaruConsent(): HaruConsentState {
  const snapshot = useSyncExternalStore(
    subscribe,
    getConsentSnapshot,
    getConsentSnapshot,
  );
  return JSON.parse(snapshot) as HaruConsentState;
}

export function hasHaruVoiceCaptureConsent(
  consent: HaruConsentState,
): boolean {
  return consent.voiceRecording;
}

export function hasHaruSttProcessingConsent(
  consent: HaruConsentState,
): boolean {
  return hasHaruVoiceCaptureConsent(consent) && consent.sttProcessing;
}

export function hasHaruTranscriptRetentionConsent(
  consent: HaruConsentState,
): boolean {
  return consent.transcriptStorage;
}

export function hasHaruAudioRetentionConsent(
  consent: HaruConsentState,
): boolean {
  return consent.audioStorage;
}

export function hasHaruVoicePipelineConsent(consent: HaruConsentState): boolean {
  return hasHaruSttProcessingConsent(consent);
}

export function getHaruVoiceConsentError(consent: HaruConsentState): string | null {
  if (!hasHaruVoiceCaptureConsent(consent)) return "voice-consent-required";
  if (!consent.sttProcessing) return "stt-consent-required";
  return null;
}
