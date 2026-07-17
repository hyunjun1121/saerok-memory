import { describe, expect, it, vi } from "vitest";
import {
  formatSttEngine,
  sttApiBaseUrl,
  transcribeStory,
} from "@/features/speech/stt";

type FetchLike = typeof fetch;

function ok(json: unknown): FetchLike {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => json,
  })) as unknown as FetchLike;
}

function fail(): FetchLike {
  return vi.fn(async () => {
    throw new Error("network down");
  }) as unknown as FetchLike;
}

function blob(bytes: number[] = [1, 2, 3]): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

describe("stt client", () => {
  it("falls back to the local default when no base url is set", () => {
    expect(sttApiBaseUrl()).toMatch(/127\.0\.0\.1:8765$/);
  });

  it("parses a successful transcript and POSTs multipart to /api/stt", async () => {
    const fetchImpl = ok({
      text: "오늘 산책했어요. ",
      noSpeech: false,
      language: "ko",
      durationSec: 3.5,
      confidence: 0.91,
    });
    const result = await transcribeStory(blob(), { fetchImpl });

    expect(result).not.toBeNull();
    expect(result?.text).toBe("오늘 산책했어요.");
    expect(result?.noSpeech).toBe(false);
    expect(result?.language).toBe("ko");
    expect(result?.durationSec).toBe(3.5);
    expect(result?.confidence).toBe(0.91);

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/stt");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("parses Qwen model metadata, revision, segments, and nullable confidence", async () => {
    const result = await transcribeStory(blob(), {
      fetchImpl: ok({
        text: "천천히 말씀드렸어요.",
        noSpeech: false,
        language: "ko-KR",
        durationSec: 4.2,
        confidence: null,
        engine: "qwen3-asr",
        model: "Qwen/Qwen3-ASR-1.7B",
        modelRevision: "a1b2c3d4",
        alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
        alignerRevision: "aligner-revision",
        preprocessingVersion: "haru-dc-hp80-rms-v1",
        segments: [
          { id: 7, start: 0.2, end: 2.4, text: " 천천히 말씀드렸어요. " },
          { id: 8, start: -1, end: 1, text: "invalid" },
        ],
      }),
    });

    expect(result).toEqual({
      text: "천천히 말씀드렸어요.",
      noSpeech: false,
      language: "ko-KR",
      durationSec: 4.2,
      confidence: null,
      engine: "qwen3-asr",
      model: "Qwen/Qwen3-ASR-1.7B",
      modelRevision: "a1b2c3d4",
      alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      alignerRevision: "aligner-revision",
      preprocessingVersion: "haru-dc-hp80-rms-v1",
      segments: [{ id: 7, start: 0.2, end: 2.4, text: "천천히 말씀드렸어요." }],
    });
    expect(formatSttEngine(result!)).toBe(
      "qwen3-asr:Qwen/Qwen3-ASR-1.7B@a1b2c3d4",
    );
  });

  it("treats backend noSpeech as authoritative and drops filler text and segments", async () => {
    const result = await transcribeStory(blob(), {
      fetchImpl: ok({
        text: "그러니까.",
        noSpeech: true,
        language: "ko-KR",
        durationSec: 30,
        confidence: null,
        engine: "qwen3-asr",
        model: "Qwen/Qwen3-ASR-1.7B",
        modelRevision: "revision",
        alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
        alignerRevision: "aligner-revision",
        preprocessingVersion: "haru-dc-hp80-rms-v1",
        segments: [{ id: 0, start: 0, end: 0.2, text: "그러니까" }],
      }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        text: "",
        noSpeech: true,
        segments: [],
        alignerRevision: "aligner-revision",
        preprocessingVersion: "haru-dc-hp80-rms-v1",
      }),
    );
  });

  it("accepts the legacy revision alias defensively", async () => {
    const result = await transcribeStory(blob(), {
      fetchImpl: ok({
        text: "안녕하세요",
        engine: "qwen3-asr",
        model: "Qwen/Qwen3-ASR-1.7B",
        revision: "legacy-revision",
      }),
    });

    expect(result?.modelRevision).toBe("legacy-revision");
  });

  it("returns null on network failure (never throws)", async () => {
    const result = await transcribeStory(blob(), { fetchImpl: fail() });
    expect(result).toBeNull();
  });

  it("returns null on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 })) as unknown as FetchLike;
    const result = await transcribeStory(blob(), { fetchImpl });
    expect(result).toBeNull();
  });

  it("returns null when the response has no text field", async () => {
    const result = await transcribeStory(blob(), {
      fetchImpl: ok({ language: "ko" }),
    });
    expect(result).toBeNull();
  });

  it("drops an out-of-range confidence value", async () => {
    const result = await transcribeStory(blob(), {
      fetchImpl: ok({ text: "안녕하세요", confidence: 2 }),
    });
    expect(result?.confidence).toBeNull();
  });

  it("returns null for an empty blob without calling fetch", async () => {
    const fetchImpl = ok({ text: "x" });
    const result = await transcribeStory(new Blob([]), { fetchImpl });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
