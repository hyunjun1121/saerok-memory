import {
  createVercelHandler,
  HARU_DEVICE_COOKIE,
  jsonBody,
  methodNotAllowed,
  repositoryFailure,
  result,
  type ApiRequest,
  type ApiResult,
} from '../../_lib/http'
import type { DataPlaneRuntime } from '../../_lib/runtime'
import { validateEnrollment } from '../../_lib/validation'

export async function handleEnrollmentRedeem(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')
  const checked = validateEnrollment(jsonBody(request), runtime.config.market)
  if (!checked.ok) return result(400, { error: checked.error })

  const rawDeviceToken = runtime.randomToken()
  const [codeHash, deviceHash] = await Promise.all([
    runtime.hashSecret(`enrollment:${checked.value.code}`),
    runtime.hashSecret(`device:${rawDeviceToken}`),
  ])

  try {
    const redemption = await runtime.repository.redeemEnrollmentCode({
      market: runtime.config.market,
      codeHash,
      deviceTokenHash: deviceHash,
      installationId: checked.value.installationId,
      consentRevision: checked.value.consentRevision,
      redeemedAt: runtime.now().toISOString(),
    })
    if (!redemption.redeemed || !redemption.participantId) {
      return result(401, { error: 'invalid_or_expired_enrollment_code' })
    }
    return result(200, {
      participantId: redemption.participantId,
      market: runtime.config.market,
      locale: runtime.config.locale,
    }, {
      'set-cookie': `${HARU_DEVICE_COOKIE}=${rawDeviceToken}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`,
    })
  } catch (error) {
    return repositoryFailure(error)
  }
}

export default createVercelHandler(handleEnrollmentRedeem)
