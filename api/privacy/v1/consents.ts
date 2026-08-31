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
import { validateConsentReceipt } from '../../_lib/validation'

export async function handleConsentReceipt(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const deviceHash = await deviceTokenHash(request, runtime)
  if (!deviceHash) return result(401, { error: 'unauthorized' })
  const checked = validateConsentReceipt(jsonBody(request))
  if (!checked.ok) return result(400, { error: checked.error })

  try {
    const stored = await runtime.repository.recordConsentReceipt({
      market: runtime.config.market,
      deviceTokenHash: deviceHash,
      revision: checked.value.revision,
      grants: checked.value.grants,
      occurredAt: checked.value.occurredAt,
    })
    return result(202, stored)
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handleConsentReceipt)
