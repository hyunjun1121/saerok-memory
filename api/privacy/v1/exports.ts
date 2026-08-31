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
import { validatePrivacyExport } from '../../_lib/validation'

export async function handlePrivacyExport(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const deviceHash = await deviceTokenHash(request, runtime)
  if (!deviceHash) return result(401, { error: 'unauthorized' })
  const checked = validatePrivacyExport(jsonBody(request))
  if (!checked.ok) return result(400, { error: checked.error })

  try {
    const exported = await runtime.repository.exportParticipantData({
      market: runtime.config.market,
      deviceTokenHash: deviceHash,
      categories: checked.value.categories,
      requestedAt: runtime.now().toISOString(),
    })
    return result(200, {
      schemaVersion: '1.0',
      market: runtime.config.market,
      generatedAt: exported.generatedAt,
      data: exported.data,
    })
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handlePrivacyExport)
