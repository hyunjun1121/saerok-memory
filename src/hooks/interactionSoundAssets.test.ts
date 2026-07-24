import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ASSET_ROOT = path.resolve(process.cwd(), "public/assets/audio/ui");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const LICENSE_PATH = path.join(ASSET_ROOT, "LICENSE.txt");

const EXPECTED_CUES = {
  select: {
    file: "select.wav",
    sourceFile: "Audio/select_001.ogg",
    sourceSha256: "aec0c31ea934a35936ae0d2ab8fac8123c93aa5647f935853a58dbaf90278b7a",
    durationMs: 40,
  },
  confirm: {
    file: "confirm.wav",
    sourceFile: "Audio/pluck_001.ogg",
    sourceSha256: "be97ec4893a02d6eccfb678daa76c83e34cb2583b834ec2593d2641def739fa4",
    durationMs: 100,
  },
  success: {
    file: "success.wav",
    sourceFile: "Audio/confirmation_001.ogg",
    sourceSha256: "063564703b6094d70718a3e787a55cc9141611e4ecd6b6637f8828f79b4a8c3a",
    durationMs: 290,
  },
  retry: {
    file: "retry.wav",
    sourceFile: "Audio/error_004.ogg",
    sourceSha256: "0b574cea597d96507e782ae9764f88482ce49f46e931e57054bf7150047f2d69",
    durationMs: 104,
  },
  routineComplete: {
    file: "routine-complete.wav",
    sourceFile: "Audio/confirmation_002.ogg",
    sourceSha256: "33b17a9a9a2397c62b285c52c33a907fdffb476909c99e42dde603f6a7a8b12c",
    durationMs: 539,
  },
  recordStart: {
    file: "record-start.wav",
    sourceFile: "Audio/open_001.ogg",
    sourceSha256: "a27c6bb0df7da1e6af5dd5937593c98bc58b6e513f42fe6a3254cd6a6949c648",
    durationMs: 148,
  },
  recordStop: {
    file: "record-stop.wav",
    sourceFile: "Audio/close_001.ogg",
    sourceSha256: "44af8249b933e0fd35ec957a638bb1a0b01f85b53fbe9674bf77bd3ca3168ef4",
    durationMs: 148,
  },
} as const;

interface SoundManifest {
  name: string;
  version: string;
  source: string;
  sourceArchive: {
    url: string;
    sha256: string;
    bytes: number;
  };
  license: string;
  licenseUrl: string;
  conversion: {
    format: string;
    sampleRateHz: number;
    channels: number;
    bitsPerSample: number;
  };
  cues: Record<
    keyof typeof EXPECTED_CUES,
    {
      file: string;
      sourceFile: string;
      sourceSha256: string;
      sha256: string;
      durationMs: number;
    }
  >;
}

function readManifest(): SoundManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as SoundManifest;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function readWaveFormat(buffer: Buffer) {
  expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(buffer.subarray(8, 12).toString("ascii")).toBe("WAVE");

  let format:
    | {
        audioFormat: number;
        channels: number;
        sampleRateHz: number;
        byteRate: number;
        bitsPerSample: number;
      }
    | undefined;
  let dataBytes: number | undefined;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") {
      const payloadOffset = offset + 8;
      format = {
        audioFormat: buffer.readUInt16LE(payloadOffset),
        channels: buffer.readUInt16LE(payloadOffset + 2),
        sampleRateHz: buffer.readUInt32LE(payloadOffset + 4),
        byteRate: buffer.readUInt32LE(payloadOffset + 8),
        bitsPerSample: buffer.readUInt16LE(payloadOffset + 14),
      };
    } else if (chunkId === "data") {
      dataBytes = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!format || dataBytes === undefined) {
    throw new Error("WAV fmt or data chunk is missing");
  }
  return {
    ...format,
    durationMs: Math.round((dataBytes / format.byteRate) * 1000),
  };
}

describe("Haru interaction sound assets", () => {
  it("tracks the CC0 source and exactly seven stable cue filenames", () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    expect(existsSync(LICENSE_PATH)).toBe(true);

    const manifest = readManifest();
    expect(manifest).toMatchObject({
      name: "Kenney Interface Sounds",
      version: "1.0",
      source: "https://kenney.nl/assets/interface-sounds",
      sourceArchive: {
        url: "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip",
        sha256: "f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232",
        bytes: 834_536,
      },
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      conversion: {
        format: "wav",
        sampleRateHz: 44_100,
        channels: 1,
        bitsPerSample: 16,
      },
    });
    expect(Object.keys(manifest.cues).sort()).toEqual(
      Object.keys(EXPECTED_CUES).sort(),
    );
    expect(
      Object.fromEntries(
        Object.entries(manifest.cues).map(([cue, entry]) => [
          cue,
          {
            file: entry.file,
            sourceFile: entry.sourceFile,
            sourceSha256: entry.sourceSha256,
            durationMs: entry.durationMs,
          },
        ]),
      ),
    ).toEqual(EXPECTED_CUES);
    expect(readFileSync(LICENSE_PATH, "utf8")).toContain(
      "Creative Commons Zero, CC0",
    );
  });

  it("keeps every cue non-empty, checksum-pinned, and browser-safe PCM WAV", () => {
    const manifest = readManifest();

    for (const [cue, expected] of Object.entries(EXPECTED_CUES)) {
      const entry = manifest.cues[cue as keyof typeof EXPECTED_CUES];
      const assetPath = path.join(ASSET_ROOT, expected.file);
      expect(existsSync(assetPath), `${cue} asset exists`).toBe(true);
      const buffer = readFileSync(assetPath);
      expect(buffer.length, `${cue} asset is non-empty`).toBeGreaterThan(44);
      expect(entry.sha256).toBe(sha256(buffer));
      expect(readWaveFormat(buffer)).toEqual({
        audioFormat: 1,
        channels: 1,
        sampleRateHz: 44_100,
        byteRate: 88_200,
        bitsPerSample: 16,
        durationMs: expected.durationMs,
      });
    }
  });

  it("keeps the complete feedback set under 200 KB", () => {
    const totalBytes = Object.values(EXPECTED_CUES).reduce(
      (sum, cue) => sum + statSync(path.join(ASSET_ROOT, cue.file)).size,
      0,
    );
    expect(totalBytes).toBeLessThanOrEqual(200 * 1024);
  });
});
