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
import { validatePrivacyDeletion } from '../../_lib/validation'

export async function handlePrivacyDeletion(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const deviceHash = await deviceTokenHash(request, runtime)
  if (!deviceHash) return result(401, { error: 'unauthorized' })
  const checked = validatePrivacyDeletion(jsonBody(request))
  if (!checked.ok) return result(400, { error: checked.error })

  try {
    const deletion = await runtime.repository.requestParticipantDeletion({
      market: runtime.config.market,
      deviceTokenHash: deviceHash,
      requestId: checked.value.requestId,
      categories: checked.value.categories,
      requestedAt: runtime.now().toISOString(),
    })
    return result(202, deletion)
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handlePrivacyDeletion)
