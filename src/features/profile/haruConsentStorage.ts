import { HARU_DEMO_PERSONA } from "@/data/haruDemoPersona";
import { writeJson } from "@/utils/safeStorage";

export const HARU_CONSENT_STORAGE_KEY = "haruRuntimeConsent";
export const HARU_CONSENT_UPDATED_EVENT = "haru:consent-updated";

export interface HaruConsentState {
  voiceRecording: boolean;
  sttProcessing: boolean;
  longitudinalUsageStorage: boolean;
  personalizedQuestionUse: boolean;
  consentedAt: string;
  updatedAt: string;
}

export type HaruConsentPermissions = Pick<
  HaruConsentState,
  | "voiceRecording"
  | "sttProcessing"
  | "longitudinalUsageStorage"
  | "personalizedQuestionUse"
>;

function defaultConsent(): HaruConsentState {
  return {
    voiceRecording: HARU_DEMO_PERSONA.consents.voiceRecording,
    sttProcessing: HARU_DEMO_PERSONA.consents.sttProcessing,
    longitudinalUsageStorage: HARU_DEMO_PERSONA.consents.longitudinalUsageStorage,
    personalizedQuestionUse: HARU_DEMO_PERSONA.consents.personalizedQuestionUse,
    consentedAt: HARU_DEMO_PERSONA.consents.consentedAt,
    updatedAt: HARU_DEMO_PERSONA.consents.consentedAt,
  };
}

function failClosedConsent(): HaruConsentState {
  return {
    ...defaultConsent(),
    voiceRecording: false,
    sttProcessing: false,
    longitudinalUsageStorage: false,
    personalizedQuestionUse: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseConsent(value: unknown): HaruConsentState | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.voiceRecording !== "boolean" ||
    typeof value.sttProcessing !== "boolean" ||
    typeof value.longitudinalUsageStorage !== "boolean" ||
    typeof value.personalizedQuestionUse !== "boolean" ||
    !isTimestamp(value.consentedAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null;
  }
  return {
    voiceRecording: value.voiceRecording,
    sttProcessing: value.sttProcessing,
    longitudinalUsageStorage: value.longitudinalUsageStorage,
    personalizedQuestionUse: value.personalizedQuestionUse,
    consentedAt: value.consentedAt,
    updatedAt: value.updatedAt,
  };
}

function consentFromStorageEvent(raw: string | null): HaruConsentState {
  if (raw === null) return failClosedConsent();
  try {
    return parseConsent(JSON.parse(raw) as unknown) ?? failClosedConsent();
  } catch {
    return failClosedConsent();
  }
}

export function getHaruConsent(): HaruConsentState {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return failClosedConsent();
    }
    const raw = window.localStorage.getItem(HARU_CONSENT_STORAGE_KEY);
    if (raw === null) return defaultConsent();
    return parseConsent(JSON.parse(raw) as unknown) ?? failClosedConsent();
  } catch {
    return failClosedConsent();
  }
}

function isSameConsent(
  left: HaruConsentState | null,
  right: HaruConsentState,
): boolean {
  return Boolean(
    left &&
      left.voiceRecording === right.voiceRecording &&
      left.sttProcessing === right.sttProcessing &&
      left.longitudinalUsageStorage === right.longitudinalUsageStorage &&
      left.personalizedQuestionUse === right.personalizedQuestionUse &&
      left.consentedAt === right.consentedAt &&
      left.updatedAt === right.updatedAt,
  );
}

function verifyPersistedConsent(expected: HaruConsentState): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const raw = window.localStorage.getItem(HARU_CONSENT_STORAGE_KEY);
    if (raw === null) return false;
    return isSameConsent(parseConsent(JSON.parse(raw) as unknown), expected);
  } catch {
    return false;
  }
}

function notifyConsentChanged(state: HaruConsentState): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<HaruConsentState>(HARU_CONSENT_UPDATED_EVENT, {
      detail: state,
    }),
  );
}

export function updateHaruConsent(
  update: Partial<HaruConsentPermissions> | Record<string, unknown>,
  now = new Date(),
): HaruConsentState {
  const current = getHaruConsent();
  const requestedUpdatedAt = now.getTime();
  const currentUpdatedAt = Date.parse(current.updatedAt);
  const nextUpdatedAt = new Date(
    Math.max(
      requestedUpdatedAt,
      Number.isFinite(currentUpdatedAt) ? currentUpdatedAt + 1 : requestedUpdatedAt,
    ),
  ).toISOString();
  const next: HaruConsentState = {
    ...current,
    ...(typeof update.voiceRecording === "boolean"
      ? { voiceRecording: update.voiceRecording }
      : {}),
    ...(typeof update.sttProcessing === "boolean"
      ? { sttProcessing: update.sttProcessing }
      : {}),
    ...(typeof update.longitudinalUsageStorage === "boolean"
      ? { longitudinalUsageStorage: update.longitudinalUsageStorage }
      : {}),
    ...(typeof update.personalizedQuestionUse === "boolean"
      ? { personalizedQuestionUse: update.personalizedQuestionUse }
      : {}),
    updatedAt: nextUpdatedAt,
  };
  if (
    !writeJson(HARU_CONSENT_STORAGE_KEY, next) ||
    !verifyPersistedConsent(next)
  ) {
    throw new Error("Unable to persist Haru consent");
  }
  notifyConsentChanged(next);
  return next;
}

export function clearHaruConsent(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.removeItem(HARU_CONSENT_STORAGE_KEY);
    if (window.localStorage.getItem(HARU_CONSENT_STORAGE_KEY) !== null) {
      return false;
    }
  } catch {
    return false;
  }
  notifyConsentChanged(defaultConsent());
  return true;
}

export function subscribeToHaruConsent(
  listener: (state: HaruConsentState) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onLocalUpdate = (event: Event) => {
    const consentEvent = event as CustomEvent<HaruConsentState>;
    listener(parseConsent(consentEvent.detail) ?? getHaruConsent());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === HARU_CONSENT_STORAGE_KEY) {
      listener(consentFromStorageEvent(event.newValue));
    } else if (event.key === null) {
      // `Storage.clear()` carries no per-key payload. Treat it as revoked until
      // a later, explicit consent record arrives.
      listener(failClosedConsent());
    }
  };
  window.addEventListener(HARU_CONSENT_UPDATED_EVENT, onLocalUpdate);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(HARU_CONSENT_UPDATED_EVENT, onLocalUpdate);
    window.removeEventListener("storage", onStorage);
  };
}
