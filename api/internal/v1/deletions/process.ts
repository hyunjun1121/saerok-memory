import {
  createVercelHandler,
  internalBearerAuthorized,
  methodNotAllowed,
  result,
  type ApiRequest,
  type ApiResult,
} from '../../../_lib/http'
import type { DataPlaneRuntime } from '../../../_lib/runtime'

const MAX_JOBS_PER_RUN = 5
const STALE_CLAIM_MS = 15 * 60 * 1000
const RETRY_DELAY_MS = 5 * 60 * 1000

interface WorkerSummary {
  claimedCount: number
  completedCount: number
  requeuedCount: number
  failedCount: number
}

function responseForSummary(summary: WorkerSummary): ApiResult {
  if (summary.requeuedCount > 0 || summary.failedCount > 0) {
    return result(503, { error: 'deletion_worker_incomplete', ...summary })
  }
  return result(200, { ...summary })
}

export async function handleDeletionWorker(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const secret = runtime.config.deletionWorkerSecret
  const bucket = runtime.config.voiceStorageBucket
  if (!secret || !bucket) return result(503, { error: 'data_plane_unavailable' })
  if (!internalBearerAuthorized(request, secret)) {
    return result(401, { error: 'unauthorized' })
  }

  const now = runtime.now()
  const claimedAt = now.toISOString()
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()
  const retryAt = new Date(now.getTime() + RETRY_DELAY_MS).toISOString()
  const summary: WorkerSummary = {
    claimedCount: 0,
    completedCount: 0,
    requeuedCount: 0,
    failedCount: 0,
  }

  for (let index = 0; index < MAX_JOBS_PER_RUN; index += 1) {
    let job
    try {
      job = await runtime.repository.claimDeletionJob({
        market: runtime.config.market,
        claimedAt,
        staleBefore,
      })
    } catch {
      return result(503, { error: 'data_plane_unavailable', ...summary })
    }
    if (!job) break
    summary.claimedCount += 1

    let failureCode:
      | 'voice_storage_delete_failed'
      | 'database_finalize_failed' = 'voice_storage_delete_failed'
    try {
      if (job.voiceStoragePaths.length > 0) {
        await runtime.repository.deleteVoiceStorageObjects({
          bucket,
          paths: job.voiceStoragePaths,
        })
      }
      failureCode = 'database_finalize_failed'
      await runtime.repository.finalizeDeletionJob({
        market: runtime.config.market,
        requestId: job.requestId,
        claimToken: job.claimToken,
        completedAt: claimedAt,
        deletedVoiceStoragePaths: job.voiceStoragePaths,
      })
      summary.completedCount += 1
    } catch {
      try {
        const failure = await runtime.repository.markDeletionJobFailure({
          market: runtime.config.market,
          requestId: job.requestId,
          claimToken: job.claimToken,
          failureCode,
          failedAt: claimedAt,
          retryAt,
        })
        if (failure.status === 'queued') summary.requeuedCount += 1
        else summary.failedCount += 1
      } catch {
        summary.failedCount += 1
      }
    }
  }

  return responseForSummary(summary)
}

export default createVercelHandler(handleDeletionWorker)
