import { describe, expect, it, vi } from 'vitest'

import type { DataPlaneRepository } from '../_lib/repository'
import { SupabaseDataPlaneRepository } from '../_lib/repository'
import type { DataPlaneRuntime } from '../_lib/runtime'
import { createRuntime } from '../_lib/runtime'
import { handleEnrollmentCodeIssue } from '../internal/v1/counselor/enrollment-codes'

const PARTICIPANT_ID = '018f0f65-4f93-7cc0-9d41-4e63c8412863'
const COUNSELOR_SECRET = 'counselor_secret_with_at_least_32_chars'

function repositoryStub(
  overrides: Partial<DataPlaneRepository> = {},
): DataPlaneRepository {
  return {
    redeemEnrollmentCode: vi.fn(async () => ({ redeemed: true })),
    issueEnrollmentCode: vi.fn(async () => ({
      created: true as const,
      participantId: PARTICIPANT_ID,
    })),
    ingestTelemetry: vi.fn(async ({ events }) => ({
      acceptedCount: events.length,
      duplicateCount: 0,
    })),
    recordConsentReceipt: vi.fn(async () => ({ accepted: true })),
    recordActivitySession: vi.fn(async () => ({ accepted: true })),
    recordQuestionAttempt: vi.fn(async () => ({ accepted: true })),
    exportParticipantData: vi.fn(async () => ({
      generatedAt: '2026-08-06T00:00:00.000Z',
      data: {},
    })),
    requestParticipantDeletion: vi.fn(async ({ requestId }) => ({
      requestId,
      status: 'queued' as const,
    })),
    getParticipantDeletionStatus: vi.fn(async ({ requestId }) => ({
      requestId,
      status: 'queued' as const,
      requestedAt: '2026-08-06T00:00:00.000Z',
      completedAt: null,
      deviceCredentialShouldExpire: false,
    })),
    claimDeletionJob: vi.fn(async () => null),
    deleteVoiceStorageObjects: vi.fn(async () => undefined),
    finalizeDeletionJob: vi.fn(async () => ({ completed: true as const })),
    markDeletionJobFailure: vi.fn(async () => ({ status: 'queued' as const })),
    ...overrides,
  }
}

function runtime(
  repository: DataPlaneRepository,
  hashSecret = vi.fn(async (value: string) => `hash:${value}`),
): DataPlaneRuntime {
  return {
    config: {
      market: 'kr',
      locale: 'ko-KR',
      supabaseUrl: 'https://kr-project.supabase.co',
      supabaseServiceRoleKey: 'service-role-key',
      enrollmentCodePepper: 'pepper',
      counselorApiSecret: COUNSELOR_SECRET,
    },
    repository,
    now: () => new Date('2026-08-06T02:00:00.000Z'),
    randomId: () => PARTICIPANT_ID,
    randomToken: () => 'unused-random-token',
    hashSecret,
  }
}

function request(
  body: unknown = { expiresInMinutes: 60 },
  secret = COUNSELOR_SECRET,
) {
  return {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body,
    query: {},
  }
}

describe('internal counselor enrollment-code issuance', () => {
  it('requires the dedicated counselor secret and never accepts a device cookie', async () => {
    const issueEnrollmentCode = vi.fn(async () => ({
      created: true as const,
      participantId: PARTICIPANT_ID,
    }))
    const repository = repositoryStub({ issueEnrollmentCode })

    expect(
      await handleEnrollmentCodeIssue(
        { ...request(), headers: { cookie: 'haru_device=device-token' } },
        runtime(repository),
      ),
    ).toMatchObject({ status: 401, body: { error: 'unauthorized' } })
    expect(
      await handleEnrollmentCodeIssue(
        request({}, 'wrong-counselor-secret'),
        runtime(repository),
      ),
    ).toMatchObject({ status: 401, body: { error: 'unauthorized' } })
    expect(issueEnrollmentCode).not.toHaveBeenCalled()
  })

  it('returns one crypto code while storing only its country-scoped hash', async () => {
    const issueEnrollmentCode = vi.fn(async () => ({
      created: true as const,
      participantId: PARTICIPANT_ID,
    }))
    const hashSecret = vi.fn(async (value: string) => `hash:${value}`)
    const repository = repositoryStub({ issueEnrollmentCode })

    const response = await handleEnrollmentCodeIssue(
      request({ expiresInMinutes: 60 }),
      runtime(repository, hashSecret),
    )

    expect(response.status).toBe(201)
    const code = response.body.code
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(response.body).toEqual({
      code,
      participantId: PARTICIPANT_ID,
      market: 'kr',
      expiresAt: '2026-08-06T03:00:00.000Z',
    })
    expect(hashSecret).toHaveBeenCalledWith(`enrollment:${String(code)}`)
    expect(issueEnrollmentCode).toHaveBeenCalledWith({
      market: 'kr',
      codeHash: `hash:enrollment:${String(code)}`,
      issuedAt: '2026-08-06T02:00:00.000Z',
      expiresAt: '2026-08-06T03:00:00.000Z',
    })
    expect(JSON.stringify(issueEnrollmentCode.mock.calls)).not.toContain(
      `"code":"${String(code)}"`,
    )
  })

  it('rejects client market overrides and invalid expiry windows', async () => {
    const repository = repositoryStub()

    for (const body of [
      { market: 'jp', expiresInMinutes: 60 },
      { expiresInMinutes: 4 },
      { expiresInMinutes: 10_081 },
      { expiresInMinutes: 12.5 },
    ]) {
      expect(
        await handleEnrollmentCodeIssue(request(body), runtime(repository)),
      ).toMatchObject({
        status: 400,
        body: { error: 'invalid_enrollment_code_request' },
      })
    }
  })

  it('retries an opaque hash collision without returning an unpersisted code', async () => {
    const issueEnrollmentCode = vi
      .fn()
      .mockResolvedValueOnce({ created: false })
      .mockResolvedValueOnce({
        created: true,
        participantId: PARTICIPANT_ID,
      })
    const repository = repositoryStub({ issueEnrollmentCode })

    const response = await handleEnrollmentCodeIssue(request({}), runtime(repository))

    expect(response.status).toBe(201)
    expect(issueEnrollmentCode).toHaveBeenCalledTimes(2)
    expect(response.body.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })
})

describe('enrollment-code repository adapter', () => {
  it('sends only hash, server market, and bounded timestamps to the issue RPC', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ created: true, participant_id: PARTICIPANT_ID }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    const repository = new SupabaseDataPlaneRepository({
      url: 'https://kr-project.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl,
    })

    await expect(
      repository.issueEnrollmentCode({
        market: 'kr',
        codeHash: 'a'.repeat(64),
        issuedAt: '2026-08-06T02:00:00.000Z',
        expiresAt: '2026-08-06T03:00:00.000Z',
      }),
    ).resolves.toEqual({ created: true, participantId: PARTICIPANT_ID })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://kr-project.supabase.co/rest/v1/rpc/issue_enrollment_code',
      expect.objectContaining({
        body: JSON.stringify({
          p_market: 'kr',
          p_code_hash: 'a'.repeat(64),
          p_issued_at: '2026-08-06T02:00:00.000Z',
          p_expires_at: '2026-08-06T03:00:00.000Z',
        }),
      }),
    )
  })
})

describe('counselor secret configuration', () => {
  it('loads only the server variable', () => {
    const common = {
      HARU_MARKET: 'kr',
      SUPABASE_URL: 'https://kr-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      HARU_ENROLLMENT_CODE_PEPPER: 'pepper',
    }
    const configured = createRuntime({
      ...common,
      HARU_COUNSELOR_API_SECRET: COUNSELOR_SECRET,
    })
    expect(configured).toMatchObject({
      ok: true,
      runtime: { config: { counselorApiSecret: COUNSELOR_SECRET } },
    })

    const viteOnly = createRuntime({
      ...common,
      VITE_HARU_COUNSELOR_API_SECRET: COUNSELOR_SECRET,
    })
    expect(viteOnly.ok).toBe(true)
    if (viteOnly.ok) {
      expect(viteOnly.runtime.config).not.toHaveProperty('counselorApiSecret')
    }
  })
})
