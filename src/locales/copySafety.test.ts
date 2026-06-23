import { describe, expect, it } from "vitest";
import ko from "./ko.json";
import en from "./en.json";
import ja from "./ja.json";

// SP-01 / SP-13: learner-facing copy must not read like a medical test,
// screening, diagnosis, or official cognitive score. Caregiver/counselor and
// support-resource copy may be more factual but is scanned separately for the
// absolute hard bans (official instrument names) only.

type Locale = "ko" | "en" | "ja";

const LEARNER_NAMESPACES = [
  "navigation",
  "home",
  "lesson",
  "result",
  "exercise",
  "routine",
  "speech",
  "weekly",
  "choice",
  "feedback",
  "topbar",
  "garden",
  "common",
];

// Hard-banned everywhere (official instrument names / medical-grade claims).
const GLOBAL_BANS = [
  "mmse",
  "moca",
  "cist",
  "k-mmse",
  "ad8",
  "gpcog",
  "tics",
  "sage",
  "slums",
  "ace-iii",
  "medical-grade",
];

// Banned in learner-facing copy (language-specific clinical framing).
const LEARNER_BANS: Record<Locale, string[]> = {
  ko: ["검사", "스크리닝", "선별", "진단", "위험도", "치매 위험", "점수"],
  en: ["diagnosis", "screening", "dementia risk", "risk score", "medical test"],
  ja: ["診断", "スクリーニング", "検査", "リスク", "スコア"],
};

function collectLeaves(
  value: unknown,
  pathPrefix: string,
  accumulator: { path: string; value: string }[],
): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    accumulator.push({ path: pathPrefix, value });
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectLeaves(child, pathPrefix ? `${pathPrefix}.${key}` : key, accumulator);
    }
  }
}

function gatherLearnerCopy(locale: Record<string, unknown>): { path: string; value: string }[] {
  const leaves: { path: string; value: string }[] = [];
  for (const ns of LEARNER_NAMESPACES) {
    if (locale[ns] !== undefined) {
      collectLeaves(locale[ns], ns, leaves);
    }
  }
  return leaves;
}

describe("learner-facing copy safety", () => {
  const cases: { locale: Locale; data: Record<string, unknown> }[] = [
    { locale: "ko", data: ko },
    { locale: "en", data: en },
    { locale: "ja", data: ja },
  ];

  for (const { locale, data } of cases) {
    it(`${locale} learner copy contains no official test names or clinical framing`, () => {
      const learnerCopy = gatherLearnerCopy(data);
      expect(learnerCopy.length).toBeGreaterThan(0);

      const offenders: string[] = [];
      for (const { path, value } of learnerCopy) {
        const lowered = value.toLowerCase();
        for (const ban of GLOBAL_BANS) {
          if (lowered.includes(ban)) {
            offenders.push(`${path}: "${value}" (contains "${ban}")`);
          }
        }
        for (const ban of LEARNER_BANS[locale]) {
          if (value.includes(ban)) {
            offenders.push(`${path}: "${value}" (contains "${ban}")`);
          }
        }
      }

      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }

  it("all three locales share the same set of top-level keys", () => {
    const koKeys = Object.keys(ko).sort();
    const enKeys = Object.keys(en).sort();
    const jaKeys = Object.keys(ja).sort();
    expect(enKeys).toEqual(koKeys);
    expect(jaKeys).toEqual(koKeys);
  });

  // SP-01: support and family namespaces are not learner-facing, so
  // LEARNER_BANS (clinical framing) are allowed there contextually, but the
  // GLOBAL_BANS (official instrument names / medical-grade claims) must never
  // leak into any user-facing copy.
  it("support and family namespaces contain no official test names (GLOBAL_BANS)", () => {
    const SCAN_NAMESPACES = ["support", "family"];
    const offenders: string[] = [];
    for (const { locale, data } of cases) {
      const leaves: { path: string; value: string }[] = [];
      for (const ns of SCAN_NAMESPACES) {
        if (data[ns] !== undefined) {
          collectLeaves(data[ns], ns, leaves);
        }
      }
      for (const { path, value } of leaves) {
        const lowered = value.toLowerCase();
        for (const ban of GLOBAL_BANS) {
          if (lowered.includes(ban)) {
            offenders.push(`${locale} ${path}: "${value}" (contains "${ban}")`);
          }
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  // SP-01 / HL-1: the brain-activation motivation copy must exist in every
  // locale and carry the benefit token ("brain" / "뇌" / "脳").
  it("result.encouragement exists in all locales and mentions the brain benefit", () => {
    const tokenByLocale: Record<Locale, string[]> = {
      ko: ["뇌"],
      en: ["brain"],
      ja: ["脳"],
    };
    for (const { locale, data } of cases) {
      const result = data.result as Record<string, unknown> | undefined;
      expect(result, `${locale} missing result namespace`).toBeDefined();
      const encouragement = result?.encouragement;
      expect(typeof encouragement, `${locale} result.encouragement missing`).toBe("string");
      const text = (encouragement as string) ?? "";
      const hit = tokenByLocale[locale].some((tok) => text.includes(tok));
      expect(hit, `${locale} result.encouragement lacks brain token: "${text}"`).toBe(true);
    }
  });
});
