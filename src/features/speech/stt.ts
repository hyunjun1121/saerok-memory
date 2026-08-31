/**
 * Client for the Haru local Qwen speech-to-text backend.
 *
 * The daily memory-story routine records audio to a Blob (webm/opus) and posts
 * it here to get a transcript. This client NEVER throws: if the backend is
 * down, unreachable, or errors, it resolves to null so the routine still
 * completes (with an empty transcript). The learner is never blocked on STT.
 */

import { getRuntimeMarketConfig } from "@/config/market";

export type HaruSpeechLocale = "ko-KR" | "ja-JP" | "en-US";

export interface TranscribeResult {
  text: string;
  noSpeech: boolean;
  language: string | null;
  durationSec: number | null;
  confidence: number | null;
  engine: string | null;
  model: string | null;
  modelRevision: string | null;
  alignerModel: string | null;
  alignerRevision: string | null;
  preprocessingVersion: string | null;
  segments: TranscribeSegment[];
}

export interface TranscribeSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

const DEFAULT_API_BASE = "http://127.0.0.1:8765";
const DEFAULT_TIMEOUT_MS = 45_000;

export function sttApiBaseUrl(): string {
  const raw = import.meta.env.VITE_STT_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : DEFAULT_API_BASE;
}

/** A backend is always considered configured (local default applies). */
export function isSttEnabled(): boolean {
  return true;
}

interface TranscribeResponse {
  text?: unknown;
  noSpeech?: unknown;
  language?: unknown;
  durationSec?: unknown;
  confidence?: unknown;
  engine?: unknown;
  model?: unknown;
  modelRevision?: unknown;
  revision?: unknown;
  alignerModel?: unknown;
  alignerRevision?: unknown;
  preprocessingVersion?: unknown;
  segments?: unknown;
}

export interface TranscribeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  language?: HaruSpeechLocale;
  /** Injectable fetch (tests). Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseSegments(value: unknown): TranscribeSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const segment = candidate as Record<string, unknown>;
    const start = segment.start;
    const end = segment.end;
    const text = optionalString(segment.text);
    if (
      typeof start !== "number" ||
      !Number.isFinite(start) ||
      start < 0 ||
      typeof end !== "number" ||
      !Number.isFinite(end) ||
      end < start ||
      !text
    ) {
      return [];
    }
    const id =
      typeof segment.id === "number" && Number.isInteger(segment.id) && segment.id >= 0
        ? segment.id
        : index;
    return [{ id, start, end, text }];
  });
}

export function formatSttEngine(result: TranscribeResult): string {
  const engine = result.engine ?? "haru-local-stt";
  if (!result.model) return engine;
  return `${engine}:${result.model}${result.modelRevision ? `@${result.modelRevision}` : ""}`;
}

export async function transcribeStory(
  blob: Blob,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult | null> {
  if (!blob || blob.size === 0) return null;

  const base = sttApiBaseUrl();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) {
      controller.abort();
    } else {
      opts.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    const form = new FormData();
    form.append("file", blob, "story.webm");
    const language = opts.language ?? getRuntimeMarketConfig().speechLanguage;

    const res = await fetchImpl(`${base}/api/stt`, {
      method: "POST",
      body: form,
      headers: { "x-haru-language": language },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as TranscribeResponse;
    if (data == null || typeof data.text !== "string") return null;
    const noSpeech = data.noSpeech === true;

    return {
      // Backend noSpeech is authoritative: never let an accidental model filler
      // string escape into durable memory/RAG data.
      text: noSpeech ? "" : data.text.trim(),
      noSpeech,
      language: typeof data.language === "string" ? data.language : null,
      durationSec: typeof data.durationSec === "number" ? data.durationSec : null,
      confidence:
        typeof data.confidence === "number" &&
        Number.isFinite(data.confidence) &&
        data.confidence >= 0 &&
        data.confidence <= 1
          ? data.confidence
          : null,
      engine: optionalString(data.engine),
      model: optionalString(data.model),
      modelRevision: optionalString(data.modelRevision) ?? optionalString(data.revision),
      alignerModel: optionalString(data.alignerModel),
      alignerRevision: optionalString(data.alignerRevision),
      preprocessingVersion: optionalString(data.preprocessingVersion),
      segments: noSpeech ? [] : parseSegments(data.segments),
    };
  } catch {
    // Abort, network, CORS, or parse failure — routine must not block on STT.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
