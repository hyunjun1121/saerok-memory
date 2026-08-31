import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import {
  HARU_VOICE_EXPERIENCE,
  resolveVoiceOutcomeReason,
  resolveSttPipelineVersion,
  voiceOutcomeReason,
} from "@/features/speech/voiceExperience";

describe("Haru assisted voice experience", () => {
  it("pins privacy-safe experiment metadata for the active UI", () => {
    expect(HARU_VOICE_EXPERIENCE).toEqual({
      voiceExperienceVariant: "assist_v2",
      waveformMode: "reactive_red",
      guidanceCopyVersion: "voice-guidance-2026-08-v2",
      sttPipelineVersion: "haru-qwen3-asr-v2",
    });
    expect(voiceOutcomeReason("completed")).toBe("completed");
    expect(voiceOutcomeReason("consent_required")).toBe("consent_required");
    expect(voiceOutcomeReason("private free text")).toBeUndefined();
    expect(resolveSttPipelineVersion("haru-dc-hp80-rms-v2")).toBe(
      "haru-dc-hp80-rms-v2",
    );
    expect(resolveSttPipelineVersion("private version with spaces")).toBe(
      HARU_VOICE_EXPERIENCE.sttPipelineVersion,
    );
  });

  it("keeps before and during guidance natural without an accuracy promise", () => {
    expect(ko.speech.guidanceBefore).toBe(
      "또박또박 말하려고 애쓰지 않으셔도 돼요. 평소처럼 편하게 말씀해 주세요.",
    );
    expect(ko.speech.guidanceDuring).toBe("AI가 들은 내용을 글로 정리하고 있어요.");
    expect(ja.speech.guidanceBefore).toBe(
      "はっきり話そうと頑張らなくても大丈夫です。いつもどおり、楽にお話しください。",
    );
    expect(ja.speech.guidanceDuring).toBe("AIが聞き取った内容を文章にまとめています。");
    expect(en.speech.guidanceBefore).toBe(
      "You do not need to make every word extra clear. Speak naturally, as you usually do.",
    );
    expect(en.speech.guidanceDuring).toBe("AI is organizing what it hears into text.");

    for (const copy of [ko.speech, ja.speech, en.speech]) {
      const guidance = `${copy.guidanceBefore} ${copy.guidanceDuring}`.toLowerCase();
      expect(guidance).not.toContain("accurate");
      expect(guidance).not.toContain("정확");
      expect(guidance).not.toContain("正確");
    }
  });

  it.each([
    ["mic-denied", "permission_denied"],
    ["audio-unavailable", "capture_failed"],
    ["voice-consent-required", "consent_required"],
    ["stt-consent-required", "consent_required"],
    ["stt-queue-failed", "stt_failed"],
    ["transcribe-failed", "stt_failed"],
    ["stt-pending", "stt_queued"],
    ["no-speech", "no_speech"],
  ] as const)("maps %s to privacy-safe outcome %s", (recognitionError, expected) => {
    expect(
      resolveVoiceOutcomeReason({
        durationMs: 1_000,
        recognitionError,
        sttStatus: "failed",
      }),
    ).toBe(expected);
  });
});
