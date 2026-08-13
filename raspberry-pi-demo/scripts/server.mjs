#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { getContentType, isMainModule, resolveRequestTarget } from "./runtime-utils.mjs";

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self' data: blob:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function parsePort(rawValue) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`Port must be an integer from 1024 to 65535; received ${rawValue}.`);
  }
  return value;
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { invalid: true };
  let start;
  let end;
  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
    return { invalid: true };
  }
  return { start, end: Math.min(end, size - 1), invalid: false };
}

function cacheControl(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (
    normalized.endsWith("/index.html") ||
    normalized.includes("/config/") ||
    normalized.endsWith("/assets/audio/narration/manifest.json") ||
    normalized.endsWith("/assets/audio/narration/model-source.json")
  ) {
    return "no-store";
  }
  return normalized.includes("/assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";
}

export function createStaticServer(rootDirectory) {
  const root = path.resolve(rootDirectory);
  return http.createServer(async (request, response) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed.\n");
      return;
    }

    try {
      const rawPath = (request.url ?? "/").split("?", 1)[0];
      const target = await resolveRequestTarget(root, rawPath);
      const metadata = await stat(target);
      const etag = `W/\"${metadata.size.toString(16)}-${Math.trunc(metadata.mtimeMs).toString(16)}\"`;
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Cache-Control", cacheControl(target));
      response.setHeader("Content-Type", getContentType(target));
      response.setHeader("ETag", etag);

      if (request.headers["if-none-match"] === etag) {
        response.writeHead(304);
        response.end();
        return;
      }

      const range = parseRange(request.headers.range, metadata.size);
      if (range?.invalid) {
        response.writeHead(416, { "Content-Range": `bytes */${metadata.size}` });
        response.end();
        return;
      }

      const status = range ? 206 : 200;
      const start = range ? range.start : 0;
      const end = range ? range.end : metadata.size - 1;
      response.setHeader("Content-Length", Math.max(0, end - start + 1));
      if (range) response.setHeader("Content-Range", `bytes ${start}-${end}/${metadata.size}`);
      response.writeHead(status);
      if (request.method === "HEAD" || metadata.size === 0) {
        response.end();
        return;
      }
      const stream = createReadStream(target, { start, end });
      stream.once("error", () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      const unsafe = error instanceof Error && error.message.startsWith("Unsafe path:");
      response.writeHead(unsafe ? 400 : 404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(unsafe ? "Bad request.\n" : "Not found.\n");
    }
  });
}

async function main() {
  const [directory = "dist/ko", rawPort = "4173", ...options] = process.argv.slice(2);
  const port = parsePort(rawPort);
  const readyFlagIndex = options.indexOf("--ready-file");
  const readyFile = readyFlagIndex >= 0 ? options[readyFlagIndex + 1] : null;
  if (readyFlagIndex >= 0 && !readyFile) {
    throw new Error("--ready-file requires a file path.");
  }
  const root = path.resolve(directory);
  const indexMetadata = await stat(path.join(root, "index.html")).catch(() => null);
  if (!indexMetadata?.isFile()) {
    throw new Error(`Static build is missing index.html: ${root}`);
  }

  if (readyFile) {
    await mkdir(path.dirname(path.resolve(readyFile)), { recursive: true });
    await unlink(path.resolve(readyFile)).catch(() => undefined);
  }
  const server = createStaticServer(root);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  if (readyFile) await writeFile(path.resolve(readyFile), `${process.pid}\n`, "utf8");
  process.stdout.write(`Haru offline server: http://127.0.0.1:${port} (${root})\n`);

  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    if (readyFile) await unlink(path.resolve(readyFile)).catch(() => undefined);
  };
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      close()
        .catch((error) => process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`))
        .finally(() => process.exit(0));
    });
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
