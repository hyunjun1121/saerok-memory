import type { PilotSession } from '@/features/pilot/pilotStorage';

const PREFIX = '/api/pilot-local';
const OUTBOX_DB = 'haruJapanPilotDelivery';
interface Delivery { key?: number; path: string; method: string; body: string | Blob; contentType: string }
let writing: Promise<unknown> = Promise.resolve();
let flushing: Promise<void> | null = null;

async function outbox(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('outbox-unavailable')); return; }
    const request = indexedDB.open(OUTBOX_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('operations', { keyPath: 'key', autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedOperations(operation?: Delivery, deleteKey?: number): Promise<Delivery[]> {
  const db = await outbox();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('operations', operation || deleteKey !== undefined ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('operations');
      if (operation) store.add(operation);
      if (deleteKey !== undefined) store.delete(deleteKey);
      const read = store.getAll();
      transaction.oncomplete = () => resolve(read.result as Delivery[]);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function pilotLocalRequest<T>(suffix: string, method = 'GET', body?: string | Blob, contentType = 'application/json'): Promise<T> {
  const response = await fetch(`${PREFIX}${suffix}`, {
    method, body, headers: body !== undefined ? { 'Content-Type': contentType } : undefined,
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`pilot-local-${response.status}`);
  return await response.json() as T;
}

export function flushPilotOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    await writing;
    let operations: Delivery[];
    try { operations = await storedOperations(); } catch { return; }
    while (operations.length) {
      const item = operations[0];
      await pilotLocalRequest(item.path, item.method, item.body, item.contentType);
      operations = await storedOperations(undefined, item.key);
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

export async function queuePilotOperation(suffix: string, method: string, body: string | Blob, contentType = 'application/json'): Promise<void> {
  const operation = { path: suffix, method, body, contentType };
  const saved = writing.catch(() => undefined).then(async () => {
    try { await storedOperations(operation); }
    catch { await pilotLocalRequest(suffix, method, body, contentType); }
  });
  writing = saved;
  await saved;
  void flushPilotOutbox().catch(() => window.dispatchEvent(new Event('haru:pilot-delivery-error')));
}

export async function getPilotLocalHealth(): Promise<{ ready: boolean; dataDirectory: string }> {
  await flushPilotOutbox();
  return pilotLocalRequest('/health');
}

export function snapshotForDisk(session: PilotSession): string {
  return JSON.stringify(session, (_key, value: unknown) => value instanceof Blob ? undefined : value);
}

export function materializeSession(value: PilotSession): PilotSession {
  return { ...value, responses: value.responses.map((response) => ({ ...response,
    ...(response.takes ? { takes: Object.fromEntries(Object.entries(response.takes).map(([part, take]) => [part, { ...take, blob: new Blob([]) }])) } : {}),
  })) };
}

export async function readPilotRecording(recordingId: string): Promise<Blob> {
  const response = await fetch(`${PREFIX}/recordings/${encodeURIComponent(recordingId)}/audio`, { cache: 'no-store' });
  if (!response.ok) throw new Error('pilot-audio-read-failed');
  return response.blob();
}
