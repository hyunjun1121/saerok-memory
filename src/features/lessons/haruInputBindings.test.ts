import { describe, expect, it } from "vitest";
import {
  findHaruChoiceIndex,
  HARU_CHOICE_KEY_BINDINGS,
  parseHaruChoiceKeyBindings,
  type HaruChoiceKeyBindings,
} from "@/features/lessons/haruInputBindings";

describe("Haru input bindings", () => {
  it("loads exactly four default choice slots from config", () => {
    expect(HARU_CHOICE_KEY_BINDINGS).toHaveLength(4);
    expect(HARU_CHOICE_KEY_BINDINGS.map((binding) => binding.key)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("resolves injected mappings by key or physical code", () => {
    const bindings: HaruChoiceKeyBindings = [
      { key: "q", code: "KeyQ" },
      { key: "w", code: "KeyW" },
      { key: "e", code: "KeyE" },
      { key: "r", code: "KeyR" },
    ];

    expect(findHaruChoiceIndex(bindings, { key: "e", code: "KeyE" })).toBe(2);
    expect(findHaruChoiceIndex(bindings, { key: "z", code: "KeyR" })).toBe(3);
    expect(findHaruChoiceIndex(bindings, { key: "x", code: "KeyX" })).toBe(-1);
  });

  it("uses physical code before a conflicting key fallback", () => {
    const bindings: HaruChoiceKeyBindings = [
      { key: "q", code: "KeyA" },
      { key: "w", code: "KeyQ" },
      { key: "e", code: "KeyE" },
      { key: "r", code: "KeyR" },
    ];

    expect(findHaruChoiceIndex(bindings, { key: "q", code: "KeyQ" })).toBe(1);
  });

  it("rejects missing slots and duplicate mappings", () => {
    expect(() =>
      parseHaruChoiceKeyBindings(
        JSON.stringify({ version: 1, choiceBindings: [{ key: "1" }] }),
      ),
    ).toThrow("exactly four choices");

    expect(() =>
      parseHaruChoiceKeyBindings(
        JSON.stringify({
          version: 1,
          choiceBindings: [
            { key: "1" },
            { key: "1" },
            { key: "3" },
            { key: "4" },
          ],
        }),
      ),
    ).toThrow("duplicated");
  });
});
