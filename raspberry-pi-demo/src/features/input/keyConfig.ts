export const BUTTON_SLOTS = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
] as const;

export type ButtonSlot = (typeof BUTTON_SLOTS)[number];
export type ButtonColumn = "left" | "right";

export interface RawButtonBinding {
  key?: string;
  code?: string;
}

export interface FourButtonKeyConfig {
  readonly version: 1;
  readonly debounceMs: number;
  readonly bindings: Readonly<Record<ButtonSlot, Readonly<RawButtonBinding>>>;
}

export type RawFourButtonConfig = unknown;

const DEFAULT_DEBOUNCE_MS = 200;

export const DEFAULT_FOUR_BUTTON_CONFIG: FourButtonKeyConfig = {
  version: 1,
  debounceMs: DEFAULT_DEBOUNCE_MS,
  bindings: {
    topLeft: { key: "1", code: "Digit1" },
    topRight: { key: "2", code: "Digit2" },
    bottomLeft: { key: "3", code: "Digit3" },
    bottomRight: { key: "4", code: "Digit4" },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRawSource(source: RawFourButtonConfig): unknown {
  if (typeof source !== "string") return source;

  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Four-button config must be valid JSON.${detail}`, {
      cause: error,
    });
  }
}

function parseBinding(value: unknown, slot: ButtonSlot): Readonly<RawButtonBinding> {
  if (!isRecord(value)) {
    throw new Error(`Four-button binding "${slot}" must be an object.`);
  }

  if (
    value.key !== undefined &&
    (typeof value.key !== "string" || value.key.length === 0 || value.key.length > 32)
  ) {
    throw new Error(`Four-button binding "${slot}" key is invalid.`);
  }
  if (
    value.code !== undefined &&
    (typeof value.code !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(value.code))
  ) {
    throw new Error(`Four-button binding "${slot}" code is invalid.`);
  }

  const key = value.key as string | undefined;
  const code = value.code as string | undefined;

  if (!key && !code) {
    throw new Error(`Four-button binding "${slot}" needs a key or code.`);
  }

  return {
    ...(key === undefined ? {} : { key }),
    ...(code === undefined ? {} : { code }),
  };
}

function assertUniqueBindings(
  bindings: Readonly<Record<ButtonSlot, Readonly<RawButtonBinding>>>,
): void {
  const keys = new Set<string>();
  const codes = new Set<string>();
  const physicalOwners = new Map<string, ButtonSlot>();

  const claimPhysicalKey = (physicalKey: string | null, slot: ButtonSlot) => {
    if (physicalKey === null) return;
    const owner = physicalOwners.get(physicalKey);
    if (owner !== undefined && owner !== slot) {
      throw new Error(
        `Four-button config maps physical key "${physicalKey}" to both "${owner}" and "${slot}".`,
      );
    }
    physicalOwners.set(physicalKey, slot);
  };

  for (const slot of BUTTON_SLOTS) {
    const binding = bindings[slot];
    const keyPhysical = binding.key ? canonicalCodeForKey(binding.key) : null;
    const codePhysical = binding.code ? canonicalPhysicalCode(binding.code) : null;
    if (
      keyPhysical !== null &&
      codePhysical !== null &&
      keyPhysical !== codePhysical
    ) {
      throw new Error(
        `Four-button binding "${slot}" has mismatched physical key "${keyPhysical}" and code "${codePhysical}".`,
      );
    }
    if (binding.key) {
      if (keys.has(binding.key)) {
        throw new Error(`Four-button config has duplicated key "${binding.key}".`);
      }
      keys.add(binding.key);
      claimPhysicalKey(keyPhysical, slot);
    }
    if (binding.code) {
      if (codes.has(binding.code)) {
        throw new Error(`Four-button config has duplicated code "${binding.code}".`);
      }
      codes.add(binding.code);
      claimPhysicalKey(codePhysical, slot);
    }
  }
}

function canonicalCodeForKey(key: string): string | null {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  const punctuationCodes: Readonly<Record<string, string>> = {
    "!": "Digit1",
    "@": "Digit2",
    "#": "Digit3",
    "$": "Digit4",
    "%": "Digit5",
    "^": "Digit6",
    "&": "Digit7",
    "*": "Digit8",
    "(": "Digit9",
    ")": "Digit0",
    " ": "Space",
    "-": "Minus",
    _: "Minus",
    "=": "Equal",
    "+": "Equal",
    "[": "BracketLeft",
    "{": "BracketLeft",
    "]": "BracketRight",
    "}": "BracketRight",
    "\\": "Backslash",
    "|": "Backslash",
    ";": "Semicolon",
    ":": "Semicolon",
    "'": "Quote",
    '"': "Quote",
    "`": "Backquote",
    "~": "Backquote",
    ",": "Comma",
    "<": "Comma",
    ".": "Period",
    ">": "Period",
    "/": "Slash",
    "?": "Slash",
  };
  if (punctuationCodes[key]) return punctuationCodes[key];
  return /^[A-Za-z][A-Za-z0-9]*$/.test(key) ? key : null;
}

export function getKeyboardKeyIdentity(key: string): string {
  return canonicalCodeForKey(key) ?? key;
}

function canonicalPhysicalCode(code: string): string | null {
  const letterMatch = /^Key([a-z])$/i.exec(code);
  if (letterMatch) return `Key${letterMatch[1].toUpperCase()}`;
  return code;
}

export function parseFourButtonConfig(source: RawFourButtonConfig): FourButtonKeyConfig {
  const parsed = parseRawSource(source);
  if (!isRecord(parsed)) {
    throw new Error("Four-button config must be an object.");
  }
  if (parsed.version !== 1) {
    throw new Error("Four-button config must use version 1.");
  }
  const rawBindings = parsed.bindings;
  if (!isRecord(rawBindings)) {
    throw new Error("Four-button config must define exactly four bindings.");
  }

  const bindingKeys = Object.keys(rawBindings);
  if (
    bindingKeys.length !== BUTTON_SLOTS.length ||
    BUTTON_SLOTS.some((slot) => !(slot in rawBindings))
  ) {
    throw new Error("Four-button config must define exactly four physical slots.");
  }

  const bindings = Object.fromEntries(
    BUTTON_SLOTS.map((slot) => [slot, parseBinding(rawBindings[slot], slot)]),
  ) as Record<ButtonSlot, Readonly<RawButtonBinding>>;
  assertUniqueBindings(bindings);

  const debounceMs = parsed.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  if (
    typeof debounceMs !== "number" ||
    !Number.isInteger(debounceMs) ||
    debounceMs < 50 ||
    debounceMs > 1_000
  ) {
    throw new Error("Four-button debounceMs must be an integer from 50 to 1000.");
  }

  return {
    version: 1,
    debounceMs,
    bindings,
  };
}

export function mapKeyboardEventToSlot(
  config: FourButtonKeyConfig,
  event: Pick<KeyboardEvent, "key" | "code">,
): ButtonSlot | null {
  const codeMatch = BUTTON_SLOTS.find(
    (slot) =>
      config.bindings[slot].code !== undefined &&
      config.bindings[slot].code === event.code,
  );
  const keyMatch = BUTTON_SLOTS.find(
    (slot) =>
      config.bindings[slot].key !== undefined &&
      config.bindings[slot].key === event.key,
  );

  if (codeMatch && keyMatch && codeMatch !== keyMatch) return null;
  return codeMatch ?? keyMatch ?? null;
}

export function getButtonColumn(slot: ButtonSlot): ButtonColumn {
  return slot === "topLeft" || slot === "bottomLeft" ? "left" : "right";
}
