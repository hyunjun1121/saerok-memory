import type { MarketCode } from "@/config/market";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_GENERATED_QUESTION_STORAGE_KEY = "haruGeneratedNextDayQuestion";

export interface HaruGeneratedQuestion {
  targetDate: string;
  market: MarketCode;
  prompts: Record<"ko" | "ja" | "en", string>;
  choices: Array<{ button: "A" | "B" | "C" | "D"; label: string }>;
  correctButton: "A" | "B" | "C" | "D";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseQuestion(value: unknown): HaruGeneratedQuestion | null {
  if (!isRecord(value)) return null;
  const prompts = value.prompts;
  const choices = value.choices;
  if (
    typeof value.targetDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.targetDate) ||
    (value.market !== "kr" && value.market !== "jp") ||
    !isRecord(prompts) ||
    !["ko", "ja", "en"].every(
      (locale) =>
        typeof prompts[locale] === "string" &&
        (prompts[locale] as string).trim().length > 0 &&
        (prompts[locale] as string).length <= 180,
    ) ||
    !Array.isArray(choices) ||
    choices.length !== 4 ||
    !["A", "B", "C", "D"].every((button) =>
      choices.some(
        (choice) =>
          isRecord(choice) &&
          choice.button === button &&
          typeof choice.label === "string" &&
          choice.label.trim().length > 0 &&
          choice.label.length <= 120,
      ),
    ) ||
    !["A", "B", "C", "D"].includes(String(value.correctButton))
  ) {
    return null;
  }
  return {
    targetDate: value.targetDate,
    market: value.market,
    prompts: {
      ko: (prompts.ko as string).trim(),
      ja: (prompts.ja as string).trim(),
      en: (prompts.en as string).trim(),
    },
    choices: choices.map((choice) => ({
      button: (choice as { button: "A" | "B" | "C" | "D" }).button,
      label: (choice as { label: string }).label.trim(),
    })),
    correctButton: value.correctButton as "A" | "B" | "C" | "D",
  };
}

export function getHaruGeneratedQuestion(
  targetDate: string,
  market: MarketCode,
): HaruGeneratedQuestion | null {
  const question = parseQuestion(
    readJson<unknown>(HARU_GENERATED_QUESTION_STORAGE_KEY, null),
  );
  return question?.targetDate === targetDate && question.market === market
    ? question
    : null;
}

export function saveHaruGeneratedQuestion(question: HaruGeneratedQuestion): boolean {
  return writeJson(HARU_GENERATED_QUESTION_STORAGE_KEY, question);
}

export function clearHaruGeneratedQuestion(): boolean {
  return removeKey(HARU_GENERATED_QUESTION_STORAGE_KEY);
}
