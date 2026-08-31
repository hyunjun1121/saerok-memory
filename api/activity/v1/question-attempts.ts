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
import { validateQuestionAttempt } from '../../_lib/validation'

export async function handleQuestionAttempt(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const deviceHash = await deviceTokenHash(request, runtime)
  if (!deviceHash) return result(401, { error: 'unauthorized' })
  const checked = validateQuestionAttempt(jsonBody(request))
  if (!checked.ok) return result(400, { error: checked.error })

  try {
    const stored = await runtime.repository.recordQuestionAttempt({
      market: runtime.config.market,
      deviceTokenHash: deviceHash,
      receivedAt: runtime.now().toISOString(),
      attempt: checked.value,
    })
    return result(202, stored)
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handleQuestionAttempt)
