import configSource from "@/features/lessons/haruInputBindings.config.json?raw";

export interface HaruChoiceKeyBinding {
  key?: string;
  code?: string;
}

export type HaruChoiceKeyBindings = readonly [
  HaruChoiceKeyBinding,
  HaruChoiceKeyBinding,
  HaruChoiceKeyBinding,
  HaruChoiceKeyBinding,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBinding(value: unknown, index: number): HaruChoiceKeyBinding {
  if (!isRecord(value)) {
    throw new Error(`Haru input binding ${index + 1} must be an object.`);
  }

  const key = typeof value.key === "string" && value.key.length > 0 ? value.key : undefined;
  const code =
    typeof value.code === "string" && value.code.length > 0 ? value.code : undefined;

  if (!key && !code) {
    throw new Error(`Haru input binding ${index + 1} needs a key or code.`);
  }

  return { ...(key ? { key } : {}), ...(code ? { code } : {}) };
}

function assertUniqueBindings(bindings: readonly HaruChoiceKeyBinding[]): void {
  const keys = new Set<string>();
  const codes = new Set<string>();

  bindings.forEach((binding, index) => {
    if (binding.key) {
      if (keys.has(binding.key)) {
        throw new Error(`Haru input key "${binding.key}" is duplicated at slot ${index + 1}.`);
      }
      keys.add(binding.key);
    }

    if (binding.code) {
      if (codes.has(binding.code)) {
        throw new Error(
          `Haru input code "${binding.code}" is duplicated at slot ${index + 1}.`,
        );
      }
      codes.add(binding.code);
    }
  });
}

export function parseHaruChoiceKeyBindings(source: string): HaruChoiceKeyBindings {
  const parsed = JSON.parse(source) as unknown;
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.choiceBindings)) {
    throw new Error("Haru input binding config must use version 1 and choiceBindings.");
  }
  if (parsed.choiceBindings.length !== 4) {
    throw new Error("Haru input binding config must define exactly four choices.");
  }

  const bindings = parsed.choiceBindings.map(parseBinding);
  assertUniqueBindings(bindings);
  return bindings as unknown as HaruChoiceKeyBindings;
}

export function findHaruChoiceIndex(
  bindings: HaruChoiceKeyBindings,
  event: Pick<KeyboardEvent, "key" | "code">,
): number {
  const codeMatch = bindings.findIndex(
    (binding) => binding.code !== undefined && binding.code === event.code,
  );
  if (codeMatch >= 0) return codeMatch;

  return bindings.findIndex(
    (binding) => binding.key !== undefined && binding.key === event.key,
  );
}

export const HARU_CHOICE_KEY_BINDINGS = parseHaruChoiceKeyBindings(configSource);
