import {
  getHaruAdminUsageRecord,
  patchHaruAdminVoiceSttSuccess,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  enqueueHaruRagRecord,
  startHaruRagSync,
} from "@/features/lessons/haruRagSync";
import {
  reconcileHaruSttRetryOutbox,
  startHaruSttRetry,
} from "@/features/lessons/haruSttRetry";
import { startSttJobQueue } from "@/features/speech/sttJobQueue";
import { resumeHaruPrivacyCleanup } from "@/features/profile/haruPrivacyControls";

const INITIAL_PRIVACY_RETRY_MS = 1_000;
const MAX_PRIVACY_RETRY_MS = 60_000;

export function startHaruBackgroundSync(): () => void {
  let disposed = false;
  let stopGenericSttQueue: (() => void) | null = null;
  let stopRagSync: (() => void) | null = null;
  let stopSttRetry: (() => void) | null = null;
  let retryTimer: number | null = null;
  let retryAttempt = 0;

  const startWorkers = () => {
    if (disposed || stopRagSync) return;
    stopGenericSttQueue = startSttJobQueue();
    stopRagSync = startHaruRagSync();
    const adminRecord = getHaruAdminUsageRecord();
    if (adminRecord) {
      enqueueHaruRagRecord(adminRecord);
      reconcileHaruSttRetryOutbox(adminRecord);
    }
    stopSttRetry = startHaruSttRetry(patchHaruAdminVoiceSttSuccess);
  };

  const resumeCleanup = () => {
    void resumeHaruPrivacyCleanup().then(
      () => {
        retryAttempt = 0;
        startWorkers();
      },
      () => {
        if (disposed) return;
        const delay = Math.min(
          MAX_PRIVACY_RETRY_MS,
          INITIAL_PRIVACY_RETRY_MS * 2 ** Math.min(retryAttempt, 6),
        );
        retryAttempt += 1;
        retryTimer = window.setTimeout(resumeCleanup, delay);
      },
    );
  };

  resumeCleanup();

  return () => {
    disposed = true;
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    stopSttRetry?.();
    stopRagSync?.();
    stopGenericSttQueue?.();
  };
}
