export type NarrationLocale = "ko" | "ja";

export interface NarrationEntry {
  id: string;
  locale: NarrationLocale;
  text: string;
  path: string;
  audioPath?: string;
  sha256: string;
  durationMs?: number;
  origin?: NarrationEntryOrigin;
}

export interface BaseRightNarrationEntryOrigin {
  type: "user-selected-browser-export";
  provider: "Fish Audio";
  choice: "right";
  sourcePath: string;
  sourceSha256: string;
}

export interface MaintainerSelectedNarrationEntryOrigin {
  type: "user-selected-browser-export";
  provider: "Fish Audio";
  choice: "left" | "right";
  sourcePath: string;
  sourceSha256: string;
  candidateId: string;
  tagId: "calm_soft" | "warm_slow" | "relaxed_clear";
  tagText: string;
}

export type NarrationEntryOrigin =
  | BaseRightNarrationEntryOrigin
  | MaintainerSelectedNarrationEntryOrigin;

export interface NarrationAudioOverrides {
  schemaVersion: 1;
  locale: "ko";
  day: 1;
  provider: "Fish Audio";
  selection: "right" | "mixed";
  entryCount: number;
  baseRightEntryCount?: number;
  maintainerSelectedEntryCount?: number;
  appliedAt?: string;
}

export interface NarrationManifest {
  schemaVersion: 1;
  sourceSha256: string;
  model: {
    id: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice";
    revision: string;
    license: "Apache-2.0";
    sourceUrl: string;
  };
  audio: {
    codec: "opus";
    container: "ogg";
    channels: 1;
    loudnessTargetLufs: number;
    truePeakDbtp: number;
  };
  audioOverrides?: NarrationAudioOverrides;
  entries: NarrationEntry[];
}

/**
 * Japanese Day 1 uses a maintainer-selected Fish Audio export while the
 * remaining days continue to use the approved offline Qwen manifest above.
 * Keeping this as a small overlay avoids rewriting the complete seven-day
 * provenance manifest just to swap the 31 Day 1 clips.
 */
export interface JapaneseDay1NarrationEntry {
  id: string;
  locale: "ja";
  text: string;
  path: string;
  voiceId: "veteran";
  tagStyle: "gentle_double_pause";
  taggedText: string;
}

export interface JapaneseDay1NarrationManifest {
  schemaVersion: 1;
  locale: "ja";
  market: "jp";
  day: 1;
  provider: "Fish Audio";
  selectionCount: number;
  entries: JapaneseDay1NarrationEntry[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LOCAL_PATH_PREFIX = "assets/audio/narration/";
const JAPANESE_DAY1_OVERRIDE_PATH_PREFIX = "/assets/audio/narration/ja/day1/";

export class NarrationManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NarrationManifestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLocalNarrationPath(path: string): boolean {
  if (!path.startsWith(LOCAL_PATH_PREFIX) || path.startsWith("/")) return false;
  if (path.includes("\\") || path.includes("?") || path.includes("#")) return false;
  if (path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }

  return path.endsWith(".ogg");
}

function isLocalJapaneseDay1OverridePath(path: string): boolean {
  if (!path.startsWith(JAPANESE_DAY1_OVERRIDE_PATH_PREFIX)) return false;
  if (path.includes("\\") || path.includes("?") || path.includes("#")) return false;
  if (path.slice(1).split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }
  return path.endsWith(".mp3");
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new NarrationManifestError(`${context}.${key} must be a non-empty string`);
  }
  return value;
}

const CALM_TAGS = {
  calm_soft: "차분하고 부드럽게",
  warm_slow: "따뜻하고 천천히",
  relaxed_clear: "편안하고 또렷하게",
} as const;

function parseEntryOrigin(
  value: unknown,
  context: string,
  entryId: string,
): NarrationEntryOrigin | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new NarrationManifestError(`${context} must be an object`);
  if (
    value.type !== "user-selected-browser-export" ||
    value.provider !== "Fish Audio" ||
    (value.choice !== "left" && value.choice !== "right")
  ) {
    throw new NarrationManifestError(`${context} has unsupported provenance`);
  }
  const sourcePath = requireString(value, "sourcePath", context);
  const sourceSha256 = requireString(value, "sourceSha256", context);
  if (!SHA256_PATTERN.test(sourceSha256)) {
    throw new NarrationManifestError(`${context}.sourceSha256 must be a lowercase SHA-256 hash`);
  }

  if (/^tools\/fish-day1-browser\/audio\/[A-Za-z0-9._-]+_right\.mp3$/u.test(sourcePath)) {
    if (value.choice !== "right") throw new NarrationManifestError(`${context}.choice must match B/right`);
    return {
      type: value.type,
      provider: value.provider,
      choice: value.choice,
      sourcePath,
      sourceSha256,
    };
  }

  const calmPathMatch = /^tools\/fish-day1-browser\/calm-mood-candidates\/audio\/([A-D]_[A-Za-z0-9_]+_(left|right))\.mp3$/u.exec(sourcePath);
  if (!calmPathMatch) {
    throw new NarrationManifestError(`${context}.sourcePath must reference a calm mood candidate`);
  }
  const candidateId = requireString(value, "candidateId", context);
  const tagId = requireString(value, "tagId", context);
  const tagText = requireString(value, "tagText", context);
  if (candidateId !== calmPathMatch[1]) {
    throw new NarrationManifestError(`${context}.candidateId must match sourcePath`);
  }
  if (value.choice !== calmPathMatch[2]) {
    throw new NarrationManifestError(`${context}.choice must match sourcePath`);
  }
  if (!(tagId in CALM_TAGS) || CALM_TAGS[tagId as keyof typeof CALM_TAGS] !== tagText) {
    throw new NarrationManifestError(`${context}.tag metadata is invalid`);
  }
  if (!candidateId.includes(`_${tagId}_${value.choice}`)) {
    throw new NarrationManifestError(`${context}.tagId must match candidateId`);
  }
  const optionMatch = /^exercise\.D1_Q1\.option\.([A-D])$/u.exec(entryId);
  if (!optionMatch || !candidateId.startsWith(`${optionMatch[1]}_`)) {
    throw new NarrationManifestError(`${context}.candidateId must match the Day 1 option`);
  }
  return {
    type: value.type,
    provider: value.provider,
    choice: value.choice,
    sourcePath,
    sourceSha256,
    candidateId,
    tagId: tagId as MaintainerSelectedNarrationEntryOrigin["tagId"],
    tagText,
  };
}

function parseAudioOverrides(value: unknown): NarrationAudioOverrides | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new NarrationManifestError("manifest.audioOverrides must be an object");
  if (
    value.schemaVersion !== 1 ||
    value.locale !== "ko" ||
    value.day !== 1 ||
    value.provider !== "Fish Audio" ||
    (value.selection !== "right" && value.selection !== "mixed") ||
    !Number.isInteger(value.entryCount) ||
    (value.entryCount as number) <= 0
  ) {
    throw new NarrationManifestError("manifest.audioOverrides has an unsupported contract");
  }
  const baseRightEntryCount = value.baseRightEntryCount;
  const maintainerSelectedEntryCount = value.maintainerSelectedEntryCount;
  if (value.selection === "mixed") {
    if (
      !Number.isInteger(baseRightEntryCount) ||
      !Number.isInteger(maintainerSelectedEntryCount) ||
      (baseRightEntryCount as number) < 0 ||
      (maintainerSelectedEntryCount as number) <= 0 ||
      (baseRightEntryCount as number) + (maintainerSelectedEntryCount as number) !== value.entryCount
    ) {
      throw new NarrationManifestError("manifest.audioOverrides mixed counts are invalid");
    }
  } else if (baseRightEntryCount !== undefined || maintainerSelectedEntryCount !== undefined) {
    throw new NarrationManifestError("manifest.audioOverrides right selection cannot declare mixed counts");
  }
  if (value.appliedAt !== undefined && (typeof value.appliedAt !== "string" || value.appliedAt.trim() === "")) {
    throw new NarrationManifestError("manifest.audioOverrides.appliedAt must be a non-empty string");
  }
  return {
    schemaVersion: 1,
    locale: "ko",
    day: 1,
    provider: "Fish Audio",
    selection: value.selection,
    entryCount: value.entryCount as number,
    ...(value.selection === "mixed" ? {
      baseRightEntryCount: baseRightEntryCount as number,
      maintainerSelectedEntryCount: maintainerSelectedEntryCount as number,
    } : {}),
    ...(value.appliedAt === undefined ? {} : { appliedAt: value.appliedAt as string }),
  };
}

export function parseNarrationManifest(input: unknown): NarrationManifest {
  if (!isRecord(input)) throw new NarrationManifestError("manifest must be an object");
  if (input.schemaVersion !== 1) {
    throw new NarrationManifestError("manifest.schemaVersion must be 1");
  }

  const sourceSha256 = requireString(input, "sourceSha256", "manifest");
  if (!SHA256_PATTERN.test(sourceSha256)) {
    throw new NarrationManifestError("manifest.sourceSha256 must be a lowercase SHA-256 hash");
  }

  if (!isRecord(input.model)) throw new NarrationManifestError("manifest.model must be an object");
  const modelId = requireString(input.model, "id", "manifest.model");
  const revision = requireString(input.model, "revision", "manifest.model");
  const license = requireString(input.model, "license", "manifest.model");
  const sourceUrl = requireString(input.model, "sourceUrl", "manifest.model");
  if (modelId !== "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice") {
    throw new NarrationManifestError("manifest.model.id is not the approved Qwen model");
  }
  if (license !== "Apache-2.0") {
    throw new NarrationManifestError("manifest.model.license must be Apache-2.0");
  }

  if (!isRecord(input.audio)) throw new NarrationManifestError("manifest.audio must be an object");
  if (
    input.audio.codec !== "opus" ||
    input.audio.container !== "ogg" ||
    input.audio.channels !== 1 ||
    typeof input.audio.loudnessTargetLufs !== "number" ||
    typeof input.audio.truePeakDbtp !== "number"
  ) {
    throw new NarrationManifestError("manifest.audio has an unsupported format");
  }

  if (!Array.isArray(input.entries)) {
    throw new NarrationManifestError("manifest.entries must be an array");
  }

  const audioOverrides = parseAudioOverrides(input.audioOverrides);
  let overrideEntryCount = 0;
  let baseRightEntryCount = 0;
  let maintainerSelectedEntryCount = 0;
  const seen = new Set<string>();
  const entries = input.entries.map((rawEntry, index): NarrationEntry => {
    const context = `manifest.entries[${index}]`;
    if (!isRecord(rawEntry)) throw new NarrationManifestError(`${context} must be an object`);
    const id = requireString(rawEntry, "id", context);
    const locale = requireString(rawEntry, "locale", context);
    const text = requireString(rawEntry, "text", context);
    const path = requireString(rawEntry, "path", context);
    const audioPath = rawEntry.audioPath;
    const sha256 = requireString(rawEntry, "sha256", context);

    if (!SAFE_ID_PATTERN.test(id)) throw new NarrationManifestError(`${context}.id is invalid`);
    if (locale !== "ko" && locale !== "ja") {
      throw new NarrationManifestError(`${context}.locale must be ko or ja`);
    }
    if (!isLocalNarrationPath(path)) {
      throw new NarrationManifestError(`${context}.path must stay inside ${LOCAL_PATH_PREFIX}`);
    }
    if (audioPath !== undefined && audioPath !== path) {
      throw new NarrationManifestError(`${context}.audioPath must match path when present`);
    }
    if (!SHA256_PATTERN.test(sha256)) {
      throw new NarrationManifestError(`${context}.sha256 must be a lowercase SHA-256 hash`);
    }

    const key = `${locale}:${id}`;
    if (seen.has(key)) throw new NarrationManifestError(`duplicate narration entry: ${key}`);
    seen.add(key);

    const durationMs = rawEntry.durationMs;
    if (durationMs !== undefined && (typeof durationMs !== "number" || durationMs <= 0)) {
      throw new NarrationManifestError(`${context}.durationMs must be positive when present`);
    }
    const origin = parseEntryOrigin(rawEntry.origin, `${context}.origin`, id);
    if (origin !== undefined) {
      if (locale !== "ko") throw new NarrationManifestError(`${context}.origin is only supported for ko`);
      overrideEntryCount += 1;
      if ("candidateId" in origin) maintainerSelectedEntryCount += 1;
      else baseRightEntryCount += 1;
    }

    return {
      id,
      locale,
      text,
      path,
      ...(audioPath === undefined ? {} : { audioPath: path }),
      sha256,
      ...(durationMs === undefined ? {} : { durationMs }),
      ...(origin === undefined ? {} : { origin }),
    };
  });

  if ((audioOverrides?.entryCount ?? 0) !== overrideEntryCount) {
    throw new NarrationManifestError(
      `manifest.audioOverrides.entryCount must match ${overrideEntryCount} provenance entries`,
    );
  }
  if (audioOverrides?.selection === "right" && maintainerSelectedEntryCount !== 0) {
    throw new NarrationManifestError("manifest.audioOverrides right selection cannot include calm candidates");
  }
  if (
    audioOverrides?.selection === "mixed" &&
    (audioOverrides.baseRightEntryCount !== baseRightEntryCount ||
      audioOverrides.maintainerSelectedEntryCount !== maintainerSelectedEntryCount)
  ) {
    throw new NarrationManifestError("manifest.audioOverrides mixed counts do not match provenance entries");
  }

  return {
    schemaVersion: 1,
    sourceSha256,
    model: {
      id: modelId as NarrationManifest["model"]["id"],
      revision,
      license: license as NarrationManifest["model"]["license"],
      sourceUrl,
    },
    audio: {
      codec: "opus",
      container: "ogg",
      channels: 1,
      loudnessTargetLufs: input.audio.loudnessTargetLufs,
      truePeakDbtp: input.audio.truePeakDbtp,
    },
    ...(audioOverrides === undefined ? {} : { audioOverrides }),
    entries,
  };
}

export function parseJapaneseDay1NarrationManifest(input: unknown): JapaneseDay1NarrationManifest {
  if (!isRecord(input)) throw new NarrationManifestError("Day 1 override manifest must be an object");
  if (
    input.schemaVersion !== 1 ||
    input.locale !== "ja" ||
    input.market !== "jp" ||
    input.day !== 1 ||
    input.provider !== "Fish Audio"
  ) {
    throw new NarrationManifestError("Day 1 override manifest has unsupported metadata");
  }
  if (!Number.isInteger(input.selectionCount) || (input.selectionCount as number) <= 0) {
    throw new NarrationManifestError("Day 1 override manifest.selectionCount must be positive");
  }
  if (!Array.isArray(input.entries) || input.entries.length !== input.selectionCount) {
    throw new NarrationManifestError("Day 1 override manifest.entries must match selectionCount");
  }

  const seen = new Set<string>();
  const entries = input.entries.map((rawEntry, index): JapaneseDay1NarrationEntry => {
    const context = `Day 1 override manifest.entries[${index}]`;
    if (!isRecord(rawEntry)) throw new NarrationManifestError(`${context} must be an object`);
    const id = requireString(rawEntry, "id", context);
    const text = requireString(rawEntry, "text", context);
    const path = requireString(rawEntry, "runtimePath", context);
    const voiceId = requireString(rawEntry, "voiceId", context);
    const tagStyle = requireString(rawEntry, "tagStyle", context);
    const taggedText = requireString(rawEntry, "taggedText", context);
    if (!SAFE_ID_PATTERN.test(id)) throw new NarrationManifestError(`${context}.id is invalid`);
    if (!isLocalJapaneseDay1OverridePath(path)) {
      throw new NarrationManifestError(`${context}.runtimePath must stay inside the Day 1 MP3 directory`);
    }
    if (voiceId !== "veteran" || tagStyle !== "gentle_double_pause") {
      throw new NarrationManifestError(`${context} must use the selected veteran voice and pause style`);
    }
    if (seen.has(id)) throw new NarrationManifestError(`duplicate Day 1 override entry: ${id}`);
    seen.add(id);
    return {
      id,
      locale: "ja",
      text,
      path,
      voiceId: "veteran",
      tagStyle: "gentle_double_pause",
      taggedText,
    };
  });

  return {
    schemaVersion: 1,
    locale: "ja",
    market: "jp",
    day: 1,
    provider: "Fish Audio",
    selectionCount: entries.length,
    entries,
  };
}

export function getNarrationEntry(
  manifest: NarrationManifest,
  id: string,
  locale: NarrationLocale,
): NarrationEntry | undefined {
  return manifest.entries.find((entry) => entry.id === id && entry.locale === locale);
}
