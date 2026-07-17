export const HARU_ADMIN_DELETION_FENCE_STORAGE_KEY =
  "haruAdminDeletionFence";

/**
 * Shared, cycle-free admission guard for writes that use admin-owned storage.
 * Missing browser storage fails closed because a deletion fence cannot be
 * verified across tabs in that environment.
 */
export function hasHaruAdminDeletionFence(): boolean {
  try {
    return (
      typeof window === "undefined" ||
      !window.localStorage ||
      window.localStorage.getItem(HARU_ADMIN_DELETION_FENCE_STORAGE_KEY) !==
        null
    );
  } catch {
    return true;
  }
}
