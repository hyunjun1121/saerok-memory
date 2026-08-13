import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { checkBuildDirectory, hashCanonicalJson } from "./check-offline-build.mjs";
import {
  collectManifestFiles,
  getMarketBuildSpec,
  resolveRequestTarget,
  scanRuntimeText,
  validateRuntimeConfig,
} from "./runtime-utils.mjs";
import { createStaticServer } from "./server.mjs";

const VALID_CONFIG = {
  schemaVersion: 1,
  server: { host: "127.0.0.1", port: 4173 },
  display: { width: 1080, height: 1920, deviceScaleFactor: 2 },
  chromium: {
    profileDirectory: "runtime/chromium-profile",
    startRoute: "/lesson",
  },
  input: {
    version: 1,
    debounceMs: 200,
    bindings: {
      topLeft: { key: "1", code: "Digit1" },
      topRight: { key: "2", code: "Digit2" },
      bottomLeft: { key: "3", code: "Digit3" },
      bottomRight: { key: "4", code: "Digit4" },
    },
  },
  audio: {
    microphoneMode: "amplitude-only",
    useDeterministicFallback: true,
    narrationEnabled: true,
  },
};

test("market build settings are deterministic and reject unknown markets", () => {
  assert.deepEqual(getMarketBuildSpec("kr"), {
    market: "kr",
    localeDirectory: "ko",
    outDirectory: "dist/ko",
  });
  assert.deepEqual(getMarketBuildSpec("jp"), {
    market: "jp",
    localeDirectory: "ja",
    outDirectory: "dist/ja",
  });
  assert.throws(() => getMarketBuildSpec("en"), /kr or jp/);
});

test("runtime config accepts only loopback, portrait display, safe profile and unique keys", () => {
  assert.deepEqual(validateRuntimeConfig(VALID_CONFIG), VALID_CONFIG);

  assert.throws(
    () =>
      validateRuntimeConfig({
        ...VALID_CONFIG,
        server: { ...VALID_CONFIG.server, host: "0.0.0.0" },
      }),
    /127\.0\.0\.1/,
  );
  assert.throws(
    () =>
      validateRuntimeConfig({
        ...VALID_CONFIG,
        display: { ...VALID_CONFIG.display, width: 1920, height: 1080 },
      }),
    /portrait/,
  );
  assert.throws(
    () =>
      validateRuntimeConfig({
        ...VALID_CONFIG,
        chromium: { ...VALID_CONFIG.chromium, profileDirectory: "../outside" },
      }),
    /profileDirectory/,
  );
  assert.throws(
    () =>
      validateRuntimeConfig({
        ...VALID_CONFIG,
        input: {
          ...VALID_CONFIG.input,
          bindings: {
            ...VALID_CONFIG.input.bindings,
            bottomRight: { key: "1", code: "Digit1" },
          },
        },
      }),
    /unique/,
  );
});

test("runtime config rejects cross-kind bindings for the same physical key", () => {
  for (const [key, code, physicalKey] of [
    ["x", "KeyX", "KeyX"],
    ["X", "KeyX", "KeyX"],
    ["7", "Digit7", "Digit7"],
    ["Enter", "Enter", "Enter"],
    [" ", "Space", "Space"],
    ["/", "Slash", "Slash"],
    ["!", "Digit1", "Digit1"],
  ]) {
    assert.throws(
      () =>
        validateRuntimeConfig({
          ...VALID_CONFIG,
          input: {
            ...VALID_CONFIG.input,
            bindings: {
              topLeft: { key },
              topRight: { code },
              bottomLeft: { key: "a", code: "KeyA" },
              bottomRight: { key: "s", code: "KeyS" },
            },
          },
        }),
      new RegExp(
        `Four-button config maps physical key "${physicalKey}" to both "topLeft" and "topRight"\\.`,
      ),
    );
  }

  assert.throws(
    () =>
      validateRuntimeConfig({
        ...VALID_CONFIG,
        input: {
          ...VALID_CONFIG.input,
          bindings: {
            ...VALID_CONFIG.input.bindings,
            topLeft: { key: "x", code: "Digit1" },
          },
        },
      }),
    /binding "topLeft" has mismatched physical key "KeyX" and code "Digit1"/,
  );
});

test("offline scan catches external runtime traffic and backend endpoints", () => {
  assert.match(
    scanRuntimeText("assets/app.js", "fetch('https://cdn.example/app.json')").join("\n"),
    /external URL/,
  );
  assert.match(
    scanRuntimeText("assets/app.js", "fetch('/api/telemetry')").join("\n"),
    /API endpoint/,
  );
  assert.match(
    scanRuntimeText("assets/app.css", "body{background:url(//cdn.example/bg.png)}").join("\n"),
    /protocol-relative external URL/,
  );
  assert.match(
    scanRuntimeText("assets/app.js", "http://127.0.0.1:8765/v1/transcribe").join("\n"),
    /STT endpoint/,
  );
  assert.match(
    scanRuntimeText("assets/app.js", "http://localhost:8000/query").join("\n"),
    /RAG endpoint/,
  );
  assert.deepEqual(
    scanRuntimeText("icon.svg", '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    [],
  );
  assert.deepEqual(
    scanRuntimeText("assets/app.js", 'new URL("/lesson", "http://localhost")'),
    [],
  );
  assert.match(
    scanRuntimeText("assets/app.js", 'new URL("/lesson", "http://localhost.evil.example")').join("\n"),
    /external URL/,
  );
  assert.deepEqual(
    scanRuntimeText(
      "assets/app.js",
      'var help="https://reactjs.org/docs/error-decoder.html?invariant=321"',
    ),
    [],
  );
  assert.deepEqual(
    scanRuntimeText(
      "assets/app.js",
      'var docs="https://reactrouter.com/en/main/routers/picking-a-router.";var polyfill="https://github.com/ungap/url-search-params."',
    ),
    [],
  );
  assert.deepEqual(
    scanRuntimeText(
      "assets/audio/ui/manifest.json",
      '{"source":"https://kenney.nl/assets/interface-sounds","file":"select.wav"}',
    ),
    [],
  );
  assert.deepEqual(
    scanRuntimeText(
      "assets/audio/narration/model-source.json",
      '{"source":"https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"}',
    ),
    [],
  );
});

test("static server target stays inside build root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-static-"));
  try {
    await mkdir(path.join(root, "assets"));
    await writeFile(path.join(root, "index.html"), "home");
    await writeFile(path.join(root, "assets", "app.js"), "app");

    assert.equal(
      await resolveRequestTarget(root, "/assets/app.js"),
      path.join(root, "assets", "app.js"),
    );
    assert.equal(await resolveRequestTarget(root, "/missing-route"), path.join(root, "index.html"));
    await assert.rejects(() => resolveRequestTarget(root, "/%2e%2e/secret"), /Unsafe path/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loopback static server supports HEAD and byte ranges", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-server-"));
  const server = createStaticServer(root);
  try {
    await writeFile(path.join(root, "index.html"), "haru");
    await writeFile(path.join(root, "empty.txt"), "");
    await mkdir(path.join(root, "assets", "audio", "narration"), { recursive: true });
    await writeFile(path.join(root, "assets", "audio", "narration", "manifest.json"), "{}");
    await writeFile(path.join(root, "assets", "audio", "narration", "voice.ogg"), "ogg");
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    assert.equal(address.address, "127.0.0.1");
    const url = `http://127.0.0.1:${address.port}/`;

    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");

    const ranged = await fetch(url, { headers: { Range: "bytes=1-2" } });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-range"), "bytes 1-2/4");
    assert.equal(await ranged.text(), "ar");

    const rejected = await fetch(url, { method: "POST" });
    assert.equal(rejected.status, 405);

    const empty = await fetch(`${url}empty.txt`);
    assert.equal(empty.status, 200);
    assert.equal(await empty.text(), "");

    const narrationManifest = await fetch(`${url}assets/audio/narration/manifest.json`);
    assert.equal(narrationManifest.headers.get("cache-control"), "no-store");
    const narrationAudio = await fetch(`${url}assets/audio/narration/voice.ogg`);
    assert.equal(narrationAudio.headers.get("cache-control"), "public, max-age=31536000, immutable");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("audio manifest references resolve to required local artifacts", () => {
  assert.deepEqual(
    collectManifestFiles("assets/audio/ui/manifest.json", {
      cues: {
        select: { file: "select.wav" },
        success: { file: "success.wav" },
      },
    }),
    ["assets/audio/ui/select.wav", "assets/audio/ui/success.wav"],
  );
  assert.deepEqual(
    collectManifestFiles("assets/audio/narration/manifest.json", {
      entries: [{ file: "ko/welcome.ogg" }, { file: "ja/welcome.ogg" }],
    }),
    [
      "assets/audio/narration/ja/welcome.ogg",
      "assets/audio/narration/ko/welcome.ogg",
    ],
  );
  assert.deepEqual(
    collectManifestFiles("assets/audio/narration/manifest.json", {
      entries: [{ audioPath: "assets/audio/narration/ko/hash.ogg" }],
    }),
    ["assets/audio/narration/ko/hash.ogg"],
  );
});

test("offline build audit verifies required assets and rejects network references", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-build-"));
  try {
    await mkdir(path.join(root, "assets", "audio", "ui"), { recursive: true });
    await mkdir(path.join(root, "assets", "audio", "narration", "ko"), { recursive: true });
    await mkdir(path.join(root, "config"), { recursive: true });
    await writeFile(path.join(root, "index.html"), '<script src="./assets/app.js"></script>');
    await writeFile(path.join(root, "assets", "app.js"), "globalThis.haru=true;");
    await writeFile(path.join(root, "assets", "audio", "ui", "select.wav"), "wave");
    await writeFile(path.join(root, "assets", "audio", "ui", "LICENSE.txt"), "CC0-1.0");
    await writeFile(
      path.join(root, "assets", "audio", "ui", "manifest.json"),
      JSON.stringify({ cues: { select: { file: "select.wav" } } }),
    );
    await writeFile(path.join(root, "assets", "audio", "narration", "ko", "welcome.ogg"), "ogg");
    await writeFile(
      path.join(root, "assets", "audio", "narration", "model-source.json"),
      JSON.stringify({
        model: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        revision: "test-revision",
        license: "Apache-2.0",
        source: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
      }),
    );
    await writeFile(
      path.join(root, "assets", "audio", "narration", "manifest.json"),
      JSON.stringify({
        entries: [{ audioPath: "assets/audio/narration/ko/welcome.ogg" }],
      }),
    );
    await writeFile(path.join(root, "config", "runtime.json"), JSON.stringify(VALID_CONFIG));
    await writeFile(
      path.join(root, "config", "build-info.json"),
      JSON.stringify({ market: "kr", locale: "ko", offline: true }),
    );

    const result = await checkBuildDirectory(root);
    assert.equal(result.market, "kr");
    assert.equal(result.manifestAudioFiles, 2);

    await writeFile(path.join(root, "assets", "app.js"), "fetch('https://cdn.example/app.json')");
    await assert.rejects(() => checkBuildDirectory(root), /Forbidden online\/backend references/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("strict production audit rejects a partial narration manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "haru-strict-build-"));
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "haru-strict-source-"));
  const sourcePath = path.join(sourceRoot, "narration-source.json");
  const model = {
    id: "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    revision: "test-revision",
    license: "Apache-2.0",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
  };
  const source = {
    schemaVersion: 1,
    model,
    entries: [
      { id: "action.back", locale: "ja", text: "戻る" },
      { id: "action.back", locale: "ko", text: "뒤로 가기" },
    ],
  };
  try {
    await mkdir(path.join(root, "assets", "audio", "ui"), { recursive: true });
    await mkdir(path.join(root, "assets", "audio", "narration", "ko"), { recursive: true });
    await mkdir(path.join(root, "config"), { recursive: true });
    await writeFile(path.join(root, "index.html"), '<script src="./assets/app.js"></script>');
    await writeFile(path.join(root, "assets", "app.js"), "globalThis.haru=true;");
    await writeFile(path.join(root, "assets", "audio", "ui", "LICENSE.txt"), "CC0-1.0");
    await writeFile(path.join(root, "assets", "audio", "ui", "select.wav"), "wave");
    await writeFile(
      path.join(root, "assets", "audio", "ui", "manifest.json"),
      JSON.stringify({ cues: { select: { file: "select.wav" } } }),
    );
    const narrationBytes = "one-local-audio-file";
    const narrationSha = createHash("sha256").update(narrationBytes).digest("hex");
    const narrationPath = "assets/audio/narration/ko/back.ogg";
    await writeFile(path.join(root, ...narrationPath.split("/")), narrationBytes);
    await writeFile(
      path.join(root, "assets", "audio", "narration", "model-source.json"),
      JSON.stringify({
        model: model.id,
        revision: model.revision,
        license: model.license,
        source: model.sourceUrl,
      }),
    );
    await writeFile(
      path.join(root, "assets", "audio", "narration", "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        sourceSha256: hashCanonicalJson(source),
        model,
        entries: [
          {
            id: "action.back",
            locale: "ko",
            text: "뒤로 가기",
            path: narrationPath,
            audioPath: narrationPath,
            sha256: narrationSha,
            durationMs: 1000,
          },
        ],
      }),
    );
    await writeFile(path.join(root, "config", "runtime.json"), JSON.stringify(VALID_CONFIG));
    await writeFile(
      path.join(root, "config", "build-info.json"),
      JSON.stringify({ market: "kr", locale: "ko", offline: true }),
    );
    await writeFile(sourcePath, JSON.stringify(source));

    await assert.rejects(
      () =>
        checkBuildDirectory(root, {
          strictNarration: true,
          narrationSourcePath: sourcePath,
        }),
      /Narration manifest incomplete.*1 of 2.*missing ja:action\.back/i,
    );

    const japaneseBytes = "second-local-audio-file";
    const japaneseSha = createHash("sha256").update(japaneseBytes).digest("hex");
    const japanesePath = "assets/audio/narration/ja/back.ogg";
    await mkdir(path.dirname(path.join(root, ...japanesePath.split("/"))), { recursive: true });
    await writeFile(path.join(root, ...japanesePath.split("/")), japaneseBytes);
    const completeManifest = {
      schemaVersion: 1,
      sourceSha256: hashCanonicalJson(source),
      model,
      entries: [
        {
          id: "action.back",
          locale: "ja",
          text: "戻る",
          path: japanesePath,
          audioPath: japanesePath,
          sha256: japaneseSha,
          durationMs: 900,
        },
        {
          id: "action.back",
          locale: "ko",
          text: "뒤로 가기",
          path: narrationPath,
          audioPath: narrationPath,
          sha256: narrationSha,
          durationMs: 1000,
        },
      ],
    };
    await writeFile(
      path.join(root, "assets", "audio", "narration", "manifest.json"),
      JSON.stringify(completeManifest),
    );
    const complete = await checkBuildDirectory(root, {
      strictNarration: true,
      narrationSourcePath: sourcePath,
    });
    assert.equal(complete.narrationEntryCount, 2);
    assert.deepEqual(complete.narrationLocaleCounts, { ko: 1, ja: 1 });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});
