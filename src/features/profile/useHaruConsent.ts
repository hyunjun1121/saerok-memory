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

export function hasHaruVoicePipelineConsent(consent: HaruConsentState): boolean {
  return (
    consent.voiceRecording &&
    consent.sttProcessing &&
    consent.longitudinalUsageStorage
  );
}

export function getHaruVoiceConsentError(consent: HaruConsentState): string | null {
  if (!consent.voiceRecording || !consent.longitudinalUsageStorage) {
    return "voice-consent-required";
  }
  if (!consent.sttProcessing) return "stt-consent-required";
  return null;
}
