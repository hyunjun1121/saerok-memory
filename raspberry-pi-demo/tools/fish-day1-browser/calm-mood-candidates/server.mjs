import {
  createReadStream,
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSelectionDocument,
  readSelectionDocument,
  saveSelectionDocument,
} from "./selectionStore.mjs";

const defaultRoot = fileURLToPath(new URL(".", import.meta.url));
const MAX_JSON_BYTES = 16 * 1024;
const PUBLIC_ROOT_FILES = new Set(["index.html", "styles.css", "app.js", "manifest.json"]);
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
]);

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ""
    || (!isAbsolute(pathFromRoot)
      && pathFromRoot !== ".."
      && !pathFromRoot.startsWith(`..${sep}`));
}

function isPublicPath(path) {
  return PUBLIC_ROOT_FILES.has(path) || /^audio\/[A-Za-z0-9._-]+\.mp3$/u.test(path);
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function sendText(response, status, value) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(value);
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value ?? "");
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw new Error("Selection payload is too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Selection payload must be valid JSON");
  }
}

export function createCalmMoodSelectorServer({
  rootDirectory = defaultRoot,
  selectionsPath = join(rootDirectory, "selections.json"),
} = {}) {
  const root = realpathSync.native(resolve(rootDirectory));
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

  return createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    } catch {
      sendText(response, 400, "Malformed URL");
      return;
    }

    if (pathname === "/api/selections") {
      if (request.method === "GET") {
        try {
          sendJson(response, 200, readSelectionDocument(selectionsPath, manifest));
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }
      if (request.method === "POST") {
        try {
          const payload = await readJsonBody(request);
          const document = buildSelectionDocument(manifest, payload?.selections);
          saveSelectionDocument(selectionsPath, document);
          sendJson(response, 200, document);
        } catch (error) {
          sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }
      response.setHeader("Allow", "GET, POST");
      sendText(response, 405, "Method not allowed");
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendText(response, 405, "Method not allowed");
      return;
    }
    if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").includes("..")) {
      sendText(response, 404, "Not found");
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.split("/").filter(Boolean).join("/");
    if (!isPublicPath(relativePath)) {
      sendText(response, 404, "Not found");
      return;
    }
    const lexicalPath = resolve(join(root, relativePath));
    if (!isContained(root, lexicalPath) || !existsSync(lexicalPath)) {
      sendText(response, 404, "Not found");
      return;
    }

    let filePath;
    let fileStat;
    try {
      filePath = realpathSync.native(lexicalPath);
      fileStat = statSync(filePath);
    } catch {
      sendText(response, 404, "Not found");
      return;
    }
    if (!isContained(root, filePath) || !fileStat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }

    const baseHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": MIME_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    };
    const requestedRange = request.headers.range;
    const range = requestedRange ? parseRange(requestedRange, fileStat.size) : undefined;
    if (requestedRange && !range) {
      response.writeHead(416, { ...baseHeaders, "Content-Range": `bytes */${fileStat.size}` });
      response.end();
      return;
    }

    const contentLength = range ? range.end - range.start + 1 : fileStat.size;
    response.writeHead(range ? 206 : 200, {
      ...baseHeaders,
      "Content-Length": contentLength,
      ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${fileStat.size}` } : {}),
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined);
    stream.on("error", (error) => {
      if (response.headersSent) response.destroy(error);
      else sendText(response, 500, "Read failed");
    });
    stream.pipe(response);
  });
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const port = Number.parseInt(process.argv[2] ?? "4193", 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Port must be an integer between 1024 and 65535");
  }
  const server = createCalmMoodSelectorServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Haru calm mood TTS selector: http://127.0.0.1:${port}`);
    console.log("Press Ctrl+C to stop.");
  });
}
