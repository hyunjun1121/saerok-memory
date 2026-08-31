import {
  createVercelHandler,
  deviceTokenHash,
  jsonBody,
  methodNotAllowed,
  repositoryFailure,
  result,
  type ApiRequest,
  type ApiResult,
} from '../../_lib/http'
import type { DataPlaneRuntime } from '../../_lib/runtime'
import { validateTelemetryBatch } from '../../_lib/validation'

export async function handleTelemetryBatch(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const deviceHash = await deviceTokenHash(request, runtime)
  if (!deviceHash) return result(401, { error: 'unauthorized' })

  const checked = validateTelemetryBatch(jsonBody(request), runtime.config.market)
  if (!checked.ok) {
    return result(checked.tooLarge ? 413 : 400, { error: checked.error })
  }

  try {
    const stored = await runtime.repository.ingestTelemetry({
      market: runtime.config.market,
      locale: runtime.config.locale,
      deviceTokenHash: deviceHash,
      receivedAt: runtime.now().toISOString(),
      events: checked.value,
    })
    return result(202, {
      acceptedEventIds: checked.value.map(({ eventId }) => eventId),
      acceptedCount: stored.acceptedCount,
      duplicateCount: stored.duplicateCount,
    })
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handleTelemetryBatch)
