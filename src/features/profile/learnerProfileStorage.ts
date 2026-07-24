// Lightweight local learner profile. Supports SP-11 (today-only routine,
// minimal onboarding) and SP-03 (sound feedback toggle). All defaults keep the
// app usable with no explicit setup; nothing here ever implies a deficit.
import { readJson, writeJson } from "@/utils/safeStorage";

const PROFILE_KEY = "learnerProfile";

export type PreferredInputMode = "speech" | "tap" | "mixed";

export interface LearnerProfile {
  preferredInputMode: PreferredInputMode;
  largeTextMode: boolean;
  kioskModePreferred: boolean;
  autoStartTodayRoutine: boolean;
  soundFeedbackEnabled: boolean;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export const defaultLearnerProfile: LearnerProfile = {
  preferredInputMode: "speech",
  largeTextMode: false,
  kioskModePreferred: false,
  autoStartTodayRoutine: true,
  soundFeedbackEnabled: true,
  onboarded: false,
  createdAt: "",
  updatedAt: "",
};

function withDefaults(value: Partial<LearnerProfile> | null | undefined): LearnerProfile {
  return { ...defaultLearnerProfile, ...(value ?? {}) };
}

export function getLearnerProfile(): LearnerProfile {
  return withDefaults(readJson<Partial<LearnerProfile>>(PROFILE_KEY, {}));
}

export function saveLearnerProfile(
  update: Partial<LearnerProfile>,
): LearnerProfile | null {
  const previous = getLearnerProfile();
  const now = new Date().toISOString();
  const next: LearnerProfile = {
    ...previous,
    ...update,
    createdAt: previous.createdAt || now,
    updatedAt: now,
  };
  return writeJson(PROFILE_KEY, next) ? next : null;
}

export function setSoundFeedbackEnabled(enabled: boolean): boolean {
  return saveLearnerProfile({ soundFeedbackEnabled: enabled }) !== null;
}

export function isSoundFeedbackEnabled(): boolean {
  return getLearnerProfile().soundFeedbackEnabled;
}
