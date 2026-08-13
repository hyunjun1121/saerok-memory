import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('.', import.meta.url));
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/plain; charset=utf-8'],
  ['.ogg', 'audio/ogg'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wav', 'audio/wav'],
]);

const publicRootFiles = new Set(['index.html', 'manifest.json']);

function isPublicComparisonPath(path) {
  if (publicRootFiles.has(path)) return true;
  if (path === 'fish/LICENSE' || path === 'fish/NOTICE.txt') return true;
  if (/^[a-z0-9-]+\/REPORT\.md$/u.test(path)) return true;
  if (/^[a-z0-9-]+\/audio\/[A-Za-z0-9._-]+\.(?:ogg|wav)$/u.test(path)) return true;
  return /^[A-Za-z0-9._-]+\.(?:ogg|wav)$/u.test(path);
}

function isContained(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ''
    || (!isAbsolute(pathFromRoot)
      && pathFromRoot !== '..'
      && !pathFromRoot.startsWith(`..${sep}`));
}

function sendText(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(value);
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value ?? '');
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

export function createComparisonServer(rootDirectory = defaultRoot) {
  const root = realpathSync.native(resolve(rootDirectory));
  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      sendText(response, 405, 'Method not allowed');
      return;
    }

    let requestPath;
    try {
      requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    } catch (error) {
      if (error instanceof URIError) {
        sendText(response, 400, 'Malformed URL');
        return;
      }
      sendText(response, 400, 'Invalid URL');
      return;
    }

    const segments = requestPath.split('/');
    if (requestPath.includes('\\') || requestPath.includes('\0') || segments.includes('..')) {
      sendText(response, 404, 'Not found');
      return;
    }
    const relativePath = requestPath === '/' ? 'index.html' : segments.filter(Boolean).join('/');
    if (!isPublicComparisonPath(relativePath)) {
      sendText(response, 404, 'Not found');
      return;
    }
    const lexicalPath = resolve(join(root, relativePath));
    if (!isContained(root, lexicalPath) || !existsSync(lexicalPath)) {
      sendText(response, 404, 'Not found');
      return;
    }

    let path;
    let fileStat;
    try {
      path = realpathSync.native(lexicalPath);
      fileStat = statSync(path);
    } catch {
      sendText(response, 404, 'Not found');
      return;
    }
    if (!isContained(root, path) || !fileStat.isFile()) {
      sendText(response, 404, 'Not found');
      return;
    }

    const baseHeaders = {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes.get(extname(path).toLowerCase()) ?? 'application/octet-stream',
    };
    const requestedRange = request.headers.range;
    const range = requestedRange ? parseRange(requestedRange, fileStat.size) : undefined;
    if (requestedRange && !range) {
      response.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${fileStat.size}` });
      response.end();
      return;
    }

    const streamOptions = range ? { start: range.start, end: range.end } : undefined;
    const contentLength = range ? range.end - range.start + 1 : fileStat.size;
    response.writeHead(range ? 206 : 200, {
      ...baseHeaders,
      'Content-Length': contentLength,
      ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${fileStat.size}` } : {}),
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = createReadStream(path, streamOptions);
    stream.on('error', (error) => {
      if (response.headersSent) response.destroy(error);
      else sendText(response, 500, 'Read failed');
    });
    stream.pipe(response);
  });
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const port = Number.parseInt(process.argv[2] ?? '4190', 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Port must be an integer between 1024 and 65535');
  }
  const server = createComparisonServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Haru TTS comparison: http://127.0.0.1:${port}`);
    console.log('Press Ctrl+C to stop.');
  });
}
