import {
  createVercelHandler,
  deviceTokenHash,
  HARU_DEVICE_COOKIE,
  methodNotAllowed,
  repositoryFailure,
  result,
  type ApiRequest,
  type ApiResult,
} from '../../../_lib/http'
import type { DataPlaneRuntime } from '../../../_lib/runtime'
import { isUuid } from '../../../_lib/validation'

export async function handlePrivacyDeletionStatus(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const deviceHash = await deviceTokenHash(request, runtime)
  if (!deviceHash) return result(401, { error: 'unauthorized' })
  const rawRequestId = request.query.requestId
  const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId
  if (!isUuid(requestId)) return result(400, { error: 'invalid_request_id' })

  try {
    const deletion = await runtime.repository.getParticipantDeletionStatus({
      market: runtime.config.market,
      deviceTokenHash: deviceHash,
      requestId,
    })
    const expireCookie =
      deletion.status === 'completed' && deletion.deviceCredentialShouldExpire
        ? {
            'set-cookie': `${HARU_DEVICE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
          }
        : undefined
    return result(
      200,
      {
        requestId: deletion.requestId,
        status: deletion.status,
        requestedAt: deletion.requestedAt,
        completedAt: deletion.completedAt,
      },
      expireCookie,
    )
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handlePrivacyDeletionStatus)
