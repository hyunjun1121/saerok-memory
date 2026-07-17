const HARU_ADMIN_AUDIO_DATABASE = "haruAdminVoiceRecordings";
const HARU_ADMIN_AUDIO_STORE = "recordings";
const HARU_ADMIN_AUDIO_DATABASE_VERSION = 1;

export type HaruAdminAudioRetentionStatus = "stored" | "not_stored";

interface StoredHaruAdminAudio {
  objectKey: string;
  blob: Blob;
  storedAt: string;
}

function getIndexedDb(): IDBFactory | null {
  try {
    return typeof indexedDB === "undefined" ? null : indexedDB;
  } catch {
    return null;
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(
      HARU_ADMIN_AUDIO_DATABASE,
      HARU_ADMIN_AUDIO_DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HARU_ADMIN_AUDIO_STORE)) {
        database.createObjectStore(HARU_ADMIN_AUDIO_STORE, { keyPath: "objectKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb-open-failed"));
    request.onblocked = () => reject(new Error("indexeddb-open-blocked"));
  });
}

export async function storeHaruAdminAudio(
  objectKey: string,
  blob: Blob,
  storedAt: string,
): Promise<HaruAdminAudioRetentionStatus> {
  if (!objectKey || blob.size <= 0) return "not_stored";
  const factory = getIndexedDb();
  if (!factory) return "not_stored";

  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase(factory);
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(HARU_ADMIN_AUDIO_STORE, "readwrite");
      const record: StoredHaruAdminAudio = { objectKey, blob, storedAt };
      transaction.objectStore(HARU_ADMIN_AUDIO_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("indexeddb-write-failed"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("indexeddb-write-aborted"));
    });
    return "stored";
  } catch {
    return "not_stored";
  } finally {
    database?.close();
  }
}

export async function readHaruAdminAudio(objectKey: string): Promise<Blob | null> {
  if (!objectKey) return null;
  const factory = getIndexedDb();
  if (!factory) return null;

  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase(factory);
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database!.transaction(HARU_ADMIN_AUDIO_STORE, "readonly");
      const request = transaction.objectStore(HARU_ADMIN_AUDIO_STORE).get(objectKey);
      request.onsuccess = () => {
        const candidate = request.result as Partial<StoredHaruAdminAudio> | undefined;
        resolve(
          candidate?.objectKey === objectKey && candidate.blob instanceof Blob
            ? candidate.blob
            : null,
        );
      };
      request.onerror = () =>
        reject(request.error ?? new Error("indexeddb-read-record-failed"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("indexeddb-read-aborted"));
    });
  } finally {
    database?.close();
  }
}

export async function deleteHaruAdminAudio(objectKey: string): Promise<void> {
  if (!objectKey) return;
  const factory = getIndexedDb();
  if (!factory) return;

  let database: IDBDatabase | null = null;
  try {
    database = await openDatabase(factory);
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(HARU_ADMIN_AUDIO_STORE, "readwrite");
      transaction.objectStore(HARU_ADMIN_AUDIO_STORE).delete(objectKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("indexeddb-delete-record-failed"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("indexeddb-delete-record-aborted"));
    });
  } finally {
    database?.close();
  }
}

export async function clearHaruAdminAudioStorage(): Promise<void> {
  const factory = getIndexedDb();
  if (!factory) return;

  await new Promise<void>((resolve, reject) => {
    const request = factory.deleteDatabase(HARU_ADMIN_AUDIO_DATABASE);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb-delete-database-failed"));
    request.onblocked = () => reject(new Error("indexeddb-delete-database-blocked"));
  });
}
