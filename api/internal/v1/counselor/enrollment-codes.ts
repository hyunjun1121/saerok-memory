import { generateEnrollmentCode } from '../../../_lib/enrollmentCode'
import {
  createVercelHandler,
  internalBearerAuthorized,
  jsonBody,
  methodNotAllowed,
  result,
  type ApiRequest,
  type ApiResult,
} from '../../../_lib/http'
import type { DataPlaneRuntime } from '../../../_lib/runtime'
import { validateEnrollmentCodeIssue } from '../../../_lib/validation'

const MAX_CODE_GENERATION_ATTEMPTS = 3

export async function handleEnrollmentCodeIssue(
  request: ApiRequest,
  runtime: DataPlaneRuntime,
): Promise<ApiResult> {
  if (request.method !== 'POST') return methodNotAllowed('POST')

  const secret = runtime.config.counselorApiSecret
  if (!secret) return result(503, { error: 'data_plane_unavailable' })
  if (!internalBearerAuthorized(request, secret)) {
    return result(401, { error: 'unauthorized' })
  }

  const validated = validateEnrollmentCodeIssue(jsonBody(request) ?? {})
  if (!validated.ok) return result(400, { error: validated.error })

  const issuedAt = runtime.now()
  const expiresAt = new Date(
    issuedAt.getTime() + validated.value.expiresInMinutes * 60_000,
  )

  try {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      const code = generateEnrollmentCode()
      const codeHash = await runtime.hashSecret(`enrollment:${code}`)
      const created = await runtime.repository.issueEnrollmentCode({
        market: runtime.config.market,
        codeHash,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      })

      if (created.created) {
        return result(201, {
          code,
          participantId: created.participantId,
          market: runtime.config.market,
          expiresAt: expiresAt.toISOString(),
        })
      }
    }
  } catch {
    return result(503, { error: 'data_plane_unavailable' })
  }

  return result(503, { error: 'data_plane_unavailable' })
}

export default createVercelHandler(handleEnrollmentCodeIssue)
