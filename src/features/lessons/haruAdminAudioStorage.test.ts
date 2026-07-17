import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearHaruAdminAudioStorage,
  readHaruAdminAudio,
} from "@/features/lessons/haruAdminAudioStorage";

describe("haruAdminAudioStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a blocked database deletion instead of reporting success", async () => {
    const request: Partial<IDBOpenDBRequest> = {};
    const deleteDatabase = vi.fn(() => request as IDBOpenDBRequest);
    vi.stubGlobal("indexedDB", { deleteDatabase } as Partial<IDBFactory>);

    const deletion = clearHaruAdminAudioStorage();
    request.onblocked?.call(
      request as IDBOpenDBRequest,
      new Event("blocked") as IDBVersionChangeEvent,
    );

    await expect(deletion).rejects.toThrow("indexeddb-delete-database-blocked");
    expect(deleteDatabase).toHaveBeenCalledWith("haruAdminVoiceRecordings");
  });

  it("reads the stored Blob by object key without serializing it", async () => {
    const objectKey = "voice/USR-000001/2026-07-20/D1_Q5.webm";
    const audio = new Blob(["voice"], { type: "audio/webm" });
    const getRequest: Partial<IDBRequest<unknown>> = {};
    const get = vi.fn(() => getRequest as IDBRequest<unknown>);
    const objectStore = { get } as Partial<IDBObjectStore>;
    const transaction = {
      objectStore: vi.fn(() => objectStore as IDBObjectStore),
    } as Partial<IDBTransaction>;
    const database = {
      transaction: vi.fn(() => transaction as IDBTransaction),
      close: vi.fn(),
    } as Partial<IDBDatabase>;
    const openRequest: Partial<IDBOpenDBRequest> = {};
    Object.defineProperty(openRequest, "result", { value: database });
    const open = vi.fn(() => openRequest as IDBOpenDBRequest);
    vi.stubGlobal("indexedDB", { open } as Partial<IDBFactory>);

    const reading = readHaruAdminAudio(objectKey);
    openRequest.onsuccess?.call(openRequest as IDBOpenDBRequest, new Event("success"));
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith(objectKey));
    Object.defineProperty(getRequest, "result", {
      value: { objectKey, blob: audio, storedAt: "2026-07-20T10:00:00+09:00" },
    });
    getRequest.onsuccess?.call(getRequest as IDBRequest<unknown>, new Event("success"));

    await expect(reading).resolves.toBe(audio);
    expect(database.close).toHaveBeenCalledTimes(1);
  });
});
