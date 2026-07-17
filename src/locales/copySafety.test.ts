import { describe, expect, it } from "vitest";
import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import { mockExercises } from "@/data/mockExercises";
import {
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
} from "@/data/haru7DayExercises";
import { getLocalizedText, type LocalizedText } from "@/utils/localizedText";

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

function gatherExerciseCopy(locale: Locale): { path: string; value: string }[] {
  const leaves: { path: string; value: string }[] = [];
  const add = (path: string, value: LocalizedText | undefined) => {
    const text = getLocalizedText(value, locale);
    if (text) leaves.push({ path, value: text });
  };

  for (const exercise of mockExercises) {
    const root = `exerciseCatalog.${exercise.id}`;
    add(`${root}.prompt`, exercise.prompt);
    add(`${root}.explanation`, exercise.explanation);
    add(`${root}.audioText`, exercise.payload.audioText);
    add(`${root}.instructionText`, exercise.payload.instructionText);
    add(`${root}.phrase`, exercise.payload.phrase);
    add(`${root}.fluencyCategory`, exercise.payload.fluencyCategory);
    add(`${root}.scenarioTitle`, exercise.payload.scenarioTitle);
    add(`${root}.scenarioBody`, exercise.payload.scenarioBody);
    add(`${root}.benefitCopy`, exercise.payload.benefitCopy);
    exercise.payload.options?.forEach((option, index) => {
      add(`${root}.options.${index}.label`, option.label);
      add(`${root}.options.${index}.accessibilityLabel`, option.accessibilityLabel);
    });
    exercise.payload.items?.forEach((item, index) => {
      add(`${root}.items.${index}.label`, item.label);
      add(`${root}.items.${index}.accessibilityLabel`, item.accessibilityLabel);
    });
    exercise.payload.pairs?.forEach((pair, index) => {
      add(`${root}.pairs.${index}.left`, pair.left);
      add(`${root}.pairs.${index}.right`, pair.right);
    });
    exercise.payload.words?.forEach((word, index) => add(`${root}.words.${index}`, word));
    exercise.payload.wordCategoryCues?.forEach((cue, index) => {
      add(`${root}.wordCategoryCues.${index}.word`, cue.word);
      add(`${root}.wordCategoryCues.${index}.category`, cue.category);
    });
    exercise.payload.trailNodes?.forEach((node, index) => {
      add(`${root}.trailNodes.${index}.label`, node.label);
    });
    exercise.payload.stroopTrials?.forEach((trial, index) => {
      add(`${root}.stroopTrials.${index}.word`, trial.word);
    });
  }

  return leaves;
}

function gatherWeekPlanCopy(locale: Locale): { path: string; value: string }[] {
  const leaves: { path: string; value: string }[] = [];
  const add = (path: string, value: LocalizedText) => {
    leaves.push({ path, value: getLocalizedText(value, locale) });
  };

  for (const plan of HARU_WEEK_PLAN) {
    const root = `weekPlan.day${plan.day}`;
    add(`${root}.weekday`, plan.weekday);
    add(`${root}.title`, plan.title);
    add(`${root}.greeting`, plan.greeting);
    add(`${root}.completionMessage`, plan.completionMessage);
  }

  for (const question of HARU_WEEK_QUESTION_META) {
    const root = `weekQuestion.${question.exerciseId}`;
    if (question.personalizationSourceNote) {
      add(`${root}.personalizationSourceNote`, question.personalizationSourceNote);
    }
    add(`${root}.recordedFeedback`, question.recordedResponse.feedback);
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

  // GLOBAL_BANS are absolute: scan every locale leaf, including caregiver and
  // counselor copy added for the 7-day persona views.
  it("all locale copy contains no official test names (GLOBAL_BANS)", () => {
    const offenders: string[] = [];
    for (const { locale, data } of cases) {
      const leaves: { path: string; value: string }[] = [];
      collectLeaves(data, "", leaves);
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

  it("typed learner exercise and week-plan copy follows the same bans", () => {
    const offenders: string[] = [];
    for (const { locale } of cases) {
      const typedCopy = [...gatherExerciseCopy(locale), ...gatherWeekPlanCopy(locale)];
      for (const { path, value } of typedCopy) {
        const lowered = value.toLowerCase();
        for (const ban of GLOBAL_BANS) {
          if (lowered.includes(ban)) {
            offenders.push(`${locale} ${path}: "${value}" (contains "${ban}")`);
          }
        }
        for (const ban of LEARNER_BANS[locale]) {
          if (value.includes(ban)) {
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
