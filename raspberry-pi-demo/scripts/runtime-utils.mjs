import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BUTTON_SLOTS = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
const AUDIO_EXTENSIONS = new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav"]);

export function getMarketBuildSpec(value) {
  const market = String(value ?? "").trim().toLowerCase();
  if (market === "kr") {
    return { market, localeDirectory: "ko", outDirectory: "dist/ko" };
  }
  if (market === "jp") {
    return { market, localeDirectory: "ja", outDirectory: "dist/ja" };
  }
  throw new Error(`Market must be kr or jp; received ${JSON.stringify(value)}.`);
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) {
    return false;
  }
  const segments = value.replaceAll("\\", "/").split("/");
  return !segments.includes("..") && !segments.includes("") && !value.includes("\0");
}

function canonicalCodeForKey(key) {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  const punctuationCodes = {
    "!": "Digit1", "@": "Digit2", "#": "Digit3", "$": "Digit4", "%": "Digit5",
    "^": "Digit6", "&": "Digit7", "*": "Digit8", "(": "Digit9", ")": "Digit0",
    " ": "Space", "-": "Minus", _: "Minus", "=": "Equal", "+": "Equal",
    "[": "BracketLeft", "{": "BracketLeft", "]": "BracketRight", "}": "BracketRight",
    "\\": "Backslash", "|": "Backslash", ";": "Semicolon", ":": "Semicolon",
    "'": "Quote", '"': "Quote", "`": "Backquote", "~": "Backquote",
    ",": "Comma", "<": "Comma", ".": "Period", ">": "Period",
    "/": "Slash", "?": "Slash",
  };
  if (punctuationCodes[key]) return punctuationCodes[key];
  return /^[A-Za-z][A-Za-z0-9]*$/.test(key) ? key : null;
}

function canonicalPhysicalCode(code) {
  const letterMatch = /^Key([a-z])$/i.exec(code);
  if (letterMatch) return `Key${letterMatch[1].toUpperCase()}`;
  return code;
}

export function validateRuntimeConfig(config) {
  assertRecord(config, "runtime config");
  if (config.schemaVersion !== 1) {
    throw new Error("runtime config schemaVersion must be 1.");
  }

  assertRecord(config.server, "server");
  if (config.server.host !== "127.0.0.1") {
    throw new Error("server.host must be 127.0.0.1 so Haru stays loopback-only.");
  }
  assertInteger(config.server.port, "server.port", 1024, 65535);

  assertRecord(config.display, "display");
  assertInteger(config.display.width, "display.width", 540, 7680);
  assertInteger(config.display.height, "display.height", 960, 7680);
  if (config.display.height <= config.display.width) {
    throw new Error("display must use portrait dimensions (height greater than width).");
  }
  if (
    typeof config.display.deviceScaleFactor !== "number" ||
    !Number.isFinite(config.display.deviceScaleFactor) ||
    config.display.deviceScaleFactor < 1 ||
    config.display.deviceScaleFactor > 4
  ) {
    throw new Error("display.deviceScaleFactor must be from 1 to 4.");
  }

  assertRecord(config.chromium, "chromium");
  if (!isSafeRelativePath(config.chromium.profileDirectory)) {
    throw new Error("chromium.profileDirectory must be a safe relative path.");
  }
  if (
    typeof config.chromium.startRoute !== "string" ||
    !config.chromium.startRoute.startsWith("/") ||
    config.chromium.startRoute.startsWith("//")
  ) {
    throw new Error("chromium.startRoute must be a local route beginning with one slash.");
  }

  assertRecord(config.input, "input");
  if (config.input.version !== 1) {
    throw new Error("input.version must be 1.");
  }
  assertInteger(config.input.debounceMs, "input.debounceMs", 50, 1000);
  assertRecord(config.input.bindings, "input.bindings");
  const usedKeys = new Set();
  const usedCodes = new Set();
  const physicalOwners = new Map();
  const claimPhysicalKey = (physicalKey, slot) => {
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
    const binding = config.input.bindings[slot];
    assertRecord(binding, `input.bindings.${slot}`);
    if (binding.key === undefined && binding.code === undefined) {
      throw new Error(`input.bindings.${slot} must define key or code.`);
    }
    const keyPhysical = binding.key === undefined ? null : canonicalCodeForKey(binding.key);
    const codePhysical = binding.code === undefined ? null : canonicalPhysicalCode(binding.code);
    if (keyPhysical !== null && codePhysical !== null && keyPhysical !== codePhysical) {
      throw new Error(
        `Four-button binding "${slot}" has mismatched physical key "${keyPhysical}" and code "${codePhysical}".`,
      );
    }
    if (binding.key !== undefined) {
      if (typeof binding.key !== "string" || binding.key.length === 0 || binding.key.length > 32) {
        throw new Error(`input.bindings.${slot}.key is invalid.`);
      }
      if (usedKeys.has(binding.key)) {
        throw new Error(`input key values must be unique; duplicate ${binding.key}.`);
      }
      usedKeys.add(binding.key);
      claimPhysicalKey(keyPhysical, slot);
    }
    if (binding.code !== undefined) {
      if (typeof binding.code !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(binding.code)) {
        throw new Error(`input.bindings.${slot}.code is invalid.`);
      }
      if (usedCodes.has(binding.code)) {
        throw new Error(`input code values must be unique; duplicate ${binding.code}.`);
      }
      usedCodes.add(binding.code);
      claimPhysicalKey(codePhysical, slot);
    }
  }

  assertRecord(config.audio, "audio");
  if (config.audio.microphoneMode !== "amplitude-only") {
    throw new Error("audio.microphoneMode must be amplitude-only in offline demo mode.");
  }
  if (typeof config.audio.useDeterministicFallback !== "boolean") {
    throw new Error("audio.useDeterministicFallback must be boolean.");
  }
  if (typeof config.audio.narrationEnabled !== "boolean") {
    throw new Error("audio.narrationEnabled must be boolean.");
  }

  return config;
}

function isProvenanceManifest(relativeFile) {
  return /(?:^|\/)assets\/audio\/(?:ui\/manifest|narration\/(?:manifest|model-source))\.json$/i.test(
    relativeFile.replaceAll("\\", "/"),
  );
}

export function scanRuntimeText(relativeFile, text) {
  const normalizedFile = relativeFile.replaceAll("\\", "/");
  const findings = [];
  const checks = [
    {
      label: "STT endpoint",
      pattern: /(?:127\.0\.0\.1|localhost):8765|\/v1\/transcribe\b|\/transcribe\b/i,
    },
    {
      label: "RAG endpoint",
      pattern: /(?:127\.0\.0\.1|localhost):8000|\/rag(?:\/|\b)|rag_backend/i,
    },
    {
      label: "API endpoint",
      pattern: /(?:["'`](?:\.\.\/|\.\/|\/)api\/)|VITE_(?:STT|RAG|API)_|\/api\/(?:telemetry|events|sync)\b/i,
    },
    {
      label: "external URL",
      pattern: /(?:https?|wss?):\/\/(?!(?:(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?=[/?#\s"'`<>]|$)|www\.w3\.org\/|reactjs\.org\/docs\/error-decoder\.html|react\.dev\/errors\/|reactrouter\.com\/en\/main\/routers\/picking-a-router|github\.com\/ungap\/url-search-params))[^\s"'`<>]+/i,
    },
    {
      label: "protocol-relative external URL",
      pattern: /(?:["'`]|url\(\s*["']?)\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i,
    },
  ];

  for (const check of checks) {
    if (check.label.includes("URL") && isProvenanceManifest(normalizedFile)) {
      continue;
    }
    const match = text.match(check.pattern);
    if (match) {
      findings.push(`${check.label} in ${normalizedFile}: ${match[0]}`);
    }
  }
  return findings;
}

export function resolveManifestArtifactPath(manifestPath, candidate) {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }
  if (/^(?:[a-z]+:)?\/\//i.test(candidate) || path.posix.isAbsolute(candidate)) {
    throw new Error(`Manifest file must be local and relative: ${candidate}`);
  }
  const normalizedCandidate = candidate.replaceAll("\\", "/");
  const segments = normalizedCandidate.split("/");
  if (segments.includes("..") || segments.includes("")) {
    throw new Error(`Manifest file contains an unsafe path: ${candidate}`);
  }
  return normalizedCandidate.startsWith("assets/")
    ? normalizedCandidate
    : path.posix.join(path.posix.dirname(manifestPath.replaceAll("\\", "/")), normalizedCandidate);
}

export function collectManifestFiles(manifestPath, manifest) {
  const collected = new Set();
  const visit = (value, key = "") => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value)) {
        visit(childValue, childKey);
      }
      return;
    }
    if (
      typeof value === "string" &&
      (key === "file" || key === "path" || key === "audioFile" || key === "audioPath") &&
      AUDIO_EXTENSIONS.has(path.posix.extname(value).toLowerCase())
    ) {
      const normalized = resolveManifestArtifactPath(manifestPath, value);
      if (normalized) collected.add(normalized);
    }
  };
  visit(manifest);
  return [...collected].sort();
}

function hasUnsafePathSegments(decodedPath) {
  const slashPath = decodedPath.replaceAll("\\", "/");
  return slashPath.split("/").some((segment) => segment === ".." || segment === ".");
}

export async function resolveRequestTarget(rootDirectory, requestPathname) {
  const root = path.resolve(rootDirectory);
  let decoded;
  try {
    decoded = decodeURIComponent(requestPathname);
  } catch {
    throw new Error("Unsafe path: invalid URL encoding.");
  }
  if (decoded.includes("\0") || decoded.includes("\\") || hasUnsafePathSegments(decoded)) {
    throw new Error("Unsafe path: traversal is not allowed.");
  }

  const relative = decoded.replace(/^\/+/, "");
  const candidate = path.resolve(root, relative || "index.html");
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error("Unsafe path: target is outside build root.");
  }

  try {
    const candidateStat = await stat(candidate);
    const file = candidateStat.isDirectory() ? path.join(candidate, "index.html") : candidate;
    await access(file);
    const realFile = await realpath(file);
    const realRoot = await realpath(root);
    if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error("Unsafe path: symlink leaves build root.");
    }
    return realFile;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unsafe path:")) {
      throw error;
    }
    if (path.extname(relative)) {
      throw new Error("Not found.");
    }
    const fallback = path.join(root, "index.html");
    await access(fallback);
    return fallback;
  }
}

export function getContentType(filePath) {
  const types = {
    ".avif": "image/avif",
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jfif": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg; codecs=opus",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".wav": "audio/wav",
    ".webmanifest": "application/manifest+json",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return types[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function isMainModule(importMetaUrl, argvEntry = process.argv[1]) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(path.resolve(argvEntry)).href;
}
