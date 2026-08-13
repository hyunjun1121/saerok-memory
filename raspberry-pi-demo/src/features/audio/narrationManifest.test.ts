import {
  NarrationManifestError,
  getNarrationEntry,
  isLocalNarrationPath,
  parseNarrationManifest,
} from "@/features/audio/narrationManifest";

const SHA256 = "a".repeat(64);

function validManifest() {
  return {
    schemaVersion: 1,
    sourceSha256: "b".repeat(64),
    model: {
      id: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
      revision: "0c0e3051f131929182e2c023b9537f8b1c68adfe",
      license: "Apache-2.0",
      sourceUrl: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    },
    audio: {
      codec: "opus",
      container: "ogg",
      channels: 1,
      loudnessTargetLufs: -16,
      truePeakDbtp: -1,
    },
    entries: [
      {
        id: "exercise.D1_Q1.prompt",
        locale: "ko",
        text: "오늘 기분은 어떠세요?",
        path: "assets/audio/narration/ko/exercise__D1_Q1__prompt.ogg",
        sha256: SHA256,
      },
    ],
  };
}

describe("narration manifest", () => {
  it("accepts a valid local manifest and indexes entries", () => {
    const manifest = parseNarrationManifest(validManifest());

    expect(getNarrationEntry(manifest, "exercise.D1_Q1.prompt", "ko")?.text).toBe(
      "오늘 기분은 어떠세요?",
    );
  });

  it.each([
    "https://example.com/speech.ogg",
    "//example.com/speech.ogg",
    "/assets/audio/narration/ko/speech.ogg",
    "assets/audio/narration/../ui/success.wav",
    "assets/audio/ui/success.wav",
  ])("rejects non-local or out-of-directory path %s", (path) => {
    expect(isLocalNarrationPath(path)).toBe(false);
    const input = validManifest();
    input.entries[0].path = path;
    expect(() => parseNarrationManifest(input)).toThrow(NarrationManifestError);
  });

  it("rejects duplicate locale/id pairs", () => {
    const input = validManifest();
    input.entries.push({ ...input.entries[0] });

    expect(() => parseNarrationManifest(input)).toThrow(/duplicate/i);
  });

  it("rejects malformed hashes and empty text", () => {
    const malformedHash = validManifest();
    malformedHash.entries[0].sha256 = "not-a-hash";
    expect(() => parseNarrationManifest(malformedHash)).toThrow(/sha256/i);

    const emptyText = validManifest();
    emptyText.entries[0].text = " ";
    expect(() => parseNarrationManifest(emptyText)).toThrow(/text/i);
  });

  it("accepts a declared Day 1 B override and rejects undeclared provenance", () => {
    const base = validManifest();
    const input = {
      ...base,
      audioOverrides: {
        schemaVersion: 1,
        locale: "ko",
        day: 1,
        provider: "Fish Audio",
        selection: "right",
        entryCount: 1,
      },
      entries: [{
        ...base.entries[0],
        origin: {
          type: "user-selected-browser-export",
          provider: "Fish Audio",
          choice: "right",
          sourcePath: "tools/fish-day1-browser/audio/01_day_1_greeting_right.mp3",
          sourceSha256: "b".repeat(64),
        },
      }],
    };

    expect(parseNarrationManifest(input).entries[0].origin?.provider).toBe("Fish Audio");

    const undeclared = { ...base, entries: input.entries };
    expect(() => parseNarrationManifest(undeclared)).toThrow(/entryCount/u);
  });

  it("accepts a mixed Day 1 override with a maintainer-selected calm candidate", () => {
    const base = validManifest();
    const input = {
      ...base,
      audioOverrides: {
        schemaVersion: 1,
        locale: "ko",
        day: 1,
        provider: "Fish Audio",
        selection: "mixed",
        entryCount: 1,
        baseRightEntryCount: 0,
        maintainerSelectedEntryCount: 1,
      },
      entries: [{
        ...base.entries[0],
        id: "exercise.D1_Q1.option.A",
        text: "매우 좋음",
        origin: {
          type: "user-selected-browser-export",
          provider: "Fish Audio",
          choice: "left",
          sourcePath: "tools/fish-day1-browser/calm-mood-candidates/audio/A_very_good_calm_soft_left.mp3",
          sourceSha256: "c".repeat(64),
          candidateId: "A_very_good_calm_soft_left",
          tagId: "calm_soft",
          tagText: "차분하고 부드럽게",
        },
      }],
    };

    const parsed = parseNarrationManifest(input);
    expect(parsed.audioOverrides?.selection).toBe("mixed");
    expect(parsed.entries[0].origin?.choice).toBe("left");
  });

  it("rejects a calm candidate whose declared metadata does not match its path", () => {
    const base = validManifest();
    const input = {
      ...base,
      audioOverrides: {
        schemaVersion: 1,
        locale: "ko",
        day: 1,
        provider: "Fish Audio",
        selection: "mixed",
        entryCount: 1,
        baseRightEntryCount: 0,
        maintainerSelectedEntryCount: 1,
      },
      entries: [{
        ...base.entries[0],
        id: "exercise.D1_Q1.option.A",
        origin: {
          type: "user-selected-browser-export",
          provider: "Fish Audio",
          choice: "left",
          sourcePath: "tools/fish-day1-browser/calm-mood-candidates/audio/A_very_good_calm_soft_left.mp3",
          sourceSha256: "c".repeat(64),
          candidateId: "A_very_good_calm_soft_right",
          tagId: "calm_soft",
          tagText: "차분하고 부드럽게",
        },
      }],
    };

    expect(() => parseNarrationManifest(input)).toThrow(/candidateId/u);
  });
});
