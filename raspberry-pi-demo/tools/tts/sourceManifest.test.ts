import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface SourceEntry {
  id: string;
  locale: "ko" | "ja";
  text: string;
}

interface SourceManifest {
  entries: SourceEntry[];
  model: {
    id: string;
    voices: Record<"ko" | "ja", { speaker: string; language: string; instruct: string }>;
  };
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(
  fs.readFileSync(path.join(currentDirectory, "narration-source.json"), "utf8"),
) as SourceManifest;

describe("Qwen narration source", () => {
  it("pins the approved native Korean and Japanese voices", () => {
    expect(source.model.id).toBe("Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice");
    expect(source.model.voices.ko).toMatchObject({ speaker: "Sohee", language: "Korean" });
    expect(source.model.voices.ja).toMatchObject({ speaker: "Ono_Anna", language: "Japanese" });
    expect(source.model.voices.ko.instruct).toContain("약간 느린");
    expect(source.model.voices.ja.instruct).toContain("少しゆっくり");
  });

  it.each(["ko", "ja"] as const)("covers all 42 prompts and four-button options in %s", (locale) => {
    const localized = source.entries.filter((entry) => entry.locale === locale);
    const prompts = localized.filter((entry) => /^exercise\.D[1-7]_Q[1-6]\.prompt$/.test(entry.id));
    const options = localized.filter((entry) => /^exercise\.D[1-7]_Q[1-6]\.option\.[A-D]$/.test(entry.id));

    expect(prompts).toHaveLength(42);
    expect(options).toHaveLength(140);
    expect(localized.filter((entry) => /^exercise\.D[14]_Q6\.sequence$/.test(entry.id))).toHaveLength(2);
    expect(new Set(localized.map((entry) => entry.id)).size).toBe(localized.length);
  });

  it("contains no Korean carry-over in Japanese narration", () => {
    const japanese = source.entries.filter((entry) => entry.locale === "ja");
    expect(japanese.filter((entry) => /[가-힣]/u.test(entry.text))).toEqual([]);
  });

  it("contains all interaction guidance needed without touch", () => {
    const required = [
      "guide.welcome",
      "guide.button_test",
      "guide.choice",
      "guide.choice_confirm",
      "guide.sequence",
      "guide.voice_ready",
      "guide.voice_recording",
      "guide.voice_review",
      "guide.feedback",
      "guide.day_complete",
      "exercise.D1_Q6.sequence",
      "exercise.D4_Q6.sequence",
      "feedback.selected",
      "action.replay",
      "action.back",
      "action.next",
      "action.confirm",
    ];

    for (const locale of ["ko", "ja"] as const) {
      const ids = new Set(source.entries.filter((entry) => entry.locale === locale).map((entry) => entry.id));
      expect(required.filter((id) => !ids.has(id))).toEqual([]);
    }
  });

  it("describes voice confirmation without claiming that speech is stored", () => {
    const reviewGuides = source.entries.filter((entry) => entry.id === "guide.voice_review");
    expect(reviewGuides).toHaveLength(2);
    expect(reviewGuides.find((entry) => entry.locale === "ko")?.text).toContain("확정");
    expect(reviewGuides.find((entry) => entry.locale === "ko")?.text).not.toContain("남기");
    expect(reviewGuides.find((entry) => entry.locale === "ja")?.text).toContain("確定");
    expect(reviewGuides.find((entry) => entry.locale === "ja")?.text).not.toContain("残す");
  });
});
