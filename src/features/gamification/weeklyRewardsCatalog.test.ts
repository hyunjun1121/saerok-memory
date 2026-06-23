import { describe, expect, it } from "vitest";
import { REWARD_CATALOG } from "./weeklyRewards";
import ko from "../../locales/ko.json";
import en from "../../locales/en.json";
import ja from "../../locales/ja.json";

// SP-08: every catalog titleKey/descriptionKey must resolve to a real string in
// all three locales, so WeeklyRewardCard never shows a raw i18n key.
function resolve(data: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

describe("REWARD_CATALOG i18n (SP-08)", () => {
  const locales: Record<string, Record<string, unknown>> = { ko, en, ja };

  for (const item of REWARD_CATALOG) {
    for (const key of [item.titleKey, item.descriptionKey]) {
      it(`${key} resolves in ko/en/ja`, () => {
        for (const [locale, data] of Object.entries(locales)) {
          const value = resolve(data, key);
          expect(typeof value, `${locale} ${key} missing`).toBe("string");
          expect((value as string).length).toBeGreaterThan(0);
          // Must not leak the raw key.
          expect(value).not.toBe(key);
        }
      });
    }
  }
});
