import { describe, expect, it } from "vitest";
import type { HaruConsentState } from "@/features/profile/haruConsentStorage";
import {
  getHaruVoiceConsentError,
  hasHaruAudioRetentionConsent,
  hasHaruSttProcessingConsent,
  hasHaruTranscriptRetentionConsent,
  hasHaruVoiceCaptureConsent,
  hasHaruVoicePipelineConsent,
} from "@/features/profile/useHaruConsent";

function consent(
  overrides: Partial<HaruConsentState> = {},
): HaruConsentState {
  return {
    usageAnalytics: true,
    voiceRecording: true,
    sttProcessing: true,
    transcriptStorage: true,
    audioStorage: true,
    longitudinalUsageStorage: true,
    personalizedQuestionUse: true,
    familySharing: true,
    consentedAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("independent Haru voice consent", () => {
  it("does not make capture or STT depend on storage permissions", () => {
    const state = consent({
      transcriptStorage: false,
      audioStorage: false,
      longitudinalUsageStorage: false,
    });

    expect(hasHaruVoiceCaptureConsent(state)).toBe(true);
    expect(hasHaruSttProcessingConsent(state)).toBe(true);
    expect(hasHaruVoicePipelineConsent(state)).toBe(true);
    expect(getHaruVoiceConsentError(state)).toBeNull();
  });

  it("gates retained transcript and audio independently", () => {
    expect(
      hasHaruTranscriptRetentionConsent(
        consent({ transcriptStorage: false }),
      ),
    ).toBe(false);
    expect(
      hasHaruAudioRetentionConsent(consent({ transcriptStorage: false })),
    ).toBe(true);

    expect(
      hasHaruTranscriptRetentionConsent(consent({ audioStorage: false })),
    ).toBe(true);
    expect(
      hasHaruAudioRetentionConsent(consent({ audioStorage: false })),
    ).toBe(false);
  });

  it("reports capture and STT denials without treating storage opt-out as error", () => {
    expect(
      getHaruVoiceConsentError(consent({ voiceRecording: false })),
    ).toBe("voice-consent-required");
    expect(
      getHaruVoiceConsentError(consent({ sttProcessing: false })),
    ).toBe("stt-consent-required");
    expect(
      getHaruVoiceConsentError(
        consent({ transcriptStorage: false, audioStorage: false }),
      ),
    ).toBeNull();
  });
});
