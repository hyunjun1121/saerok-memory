import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { DataPlaneRepository } from '../_lib/repository'
import { SupabaseDataPlaneRepository } from '../_lib/repository'
import type { DataPlaneRuntime } from '../_lib/runtime'
import { createRuntime } from '../_lib/runtime'
import { handleDeletionWorker } from '../internal/v1/deletions/process'

const REQUEST_ID = '018f0f65-4f93-7cc0-9d41-4e63c8412866'
const CLAIM_TOKEN = '018f0f65-4f93-7cc0-9d41-4e63c8412867'
const WORKER_SECRET = 'worker_secret_with_at_least_32_characters'

function repositoryStub(
  overrides: Partial<DataPlaneRepository> = {},
): DataPlaneRepository {
  return {
    issueEnrollmentCode: vi.fn(async () => ({
      created: true as const,
      participantId: '018f0f65-4f93-7cc0-9d41-4e63c8412863',
    })),
    redeemEnrollmentCode: vi.fn(async () => ({ redeemed: true })),
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

function runtime(repository: DataPlaneRepository): DataPlaneRuntime {
  return {
    config: {
      market: 'jp',
      locale: 'ja-JP',
      supabaseUrl: 'https://jp-project.supabase.co',
      supabaseServiceRoleKey: 'server-only-key',
      enrollmentCodePepper: 'server-only-pepper',
      deletionWorkerSecret: WORKER_SECRET,
      voiceStorageBucket: 'haru-voice-jp',
    },
    repository,
    now: () => new Date('2026-08-06T01:00:00.000Z'),
    randomId: () => REQUEST_ID,
    randomToken: () => 'unused-random-token',
    hashSecret: async (value) => `hashed:${value}`,
  }
}

function cronRequest(secret = WORKER_SECRET) {
  return {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
    body: undefined,
    query: { market: 'kr' },
  }
}

describe('internal deletion worker', () => {
  it('rejects missing or incorrect cron secrets before claiming work', async () => {
    const claimDeletionJob = vi.fn(async () => null)
    const repository = repositoryStub({ claimDeletionJob })

    expect(
      await handleDeletionWorker(
        { ...cronRequest(), headers: {} },
        runtime(repository),
      ),
    ).toMatchObject({ status: 401, body: { error: 'unauthorized' } })
    expect(
      await handleDeletionWorker(cronRequest('wrong-secret-value'), runtime(repository)),
    ).toMatchObject({ status: 401, body: { error: 'unauthorized' } })
    expect(claimDeletionJob).not.toHaveBeenCalled()
  })

  it('deletes claimed voice objects before atomically finalizing in the runtime market', async () => {
    const order: string[] = []
    const claimDeletionJob = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push('claim')
        return {
          requestId: REQUEST_ID,
          claimToken: CLAIM_TOKEN,
          categories: ['voice'] as const,
          voiceStoragePaths: ['participant/voice-1.webm', 'participant/voice-2.webm'],
          attemptCount: 1,
        }
      })
      .mockImplementationOnce(async () => null)
    const deleteVoiceStorageObjects = vi.fn(async () => {
      order.push('storage')
    })
    const finalizeDeletionJob = vi.fn(async () => {
      order.push('finalize')
      return { completed: true as const }
    })
    const repository = repositoryStub({
      claimDeletionJob,
      deleteVoiceStorageObjects,
      finalizeDeletionJob,
    })

    const response = await handleDeletionWorker(cronRequest(), runtime(repository))

    expect(response).toEqual({
      status: 200,
      body: {
        claimedCount: 1,
        completedCount: 1,
        requeuedCount: 0,
        failedCount: 0,
      },
    })
    expect(order).toEqual(['claim', 'storage', 'finalize'])
    expect(claimDeletionJob).toHaveBeenNthCalledWith(1, {
      market: 'jp',
      claimedAt: '2026-08-06T01:00:00.000Z',
      staleBefore: '2026-08-06T00:45:00.000Z',
    })
    expect(deleteVoiceStorageObjects).toHaveBeenCalledWith({
      bucket: 'haru-voice-jp',
      paths: ['participant/voice-1.webm', 'participant/voice-2.webm'],
    })
    expect(finalizeDeletionJob).toHaveBeenCalledWith({
      market: 'jp',
      requestId: REQUEST_ID,
      claimToken: CLAIM_TOKEN,
      completedAt: '2026-08-06T01:00:00.000Z',
      deletedVoiceStoragePaths: [
        'participant/voice-1.webm',
        'participant/voice-2.webm',
      ],
    })
  })

  it('requeues a storage failure without calling finalize or exposing error text', async () => {
    const claimDeletionJob = vi
      .fn()
      .mockResolvedValueOnce({
        requestId: REQUEST_ID,
        claimToken: CLAIM_TOKEN,
        categories: ['all'] as const,
        voiceStoragePaths: ['participant/voice.webm'],
        attemptCount: 2,
      })
      .mockResolvedValueOnce(null)
    const finalizeDeletionJob = vi.fn(async () => ({ completed: true as const }))
    const markDeletionJobFailure = vi.fn(async () => ({ status: 'queued' as const }))
    const repository = repositoryStub({
      claimDeletionJob,
      deleteVoiceStorageObjects: vi.fn(async () => {
        throw new Error('private storage provider response')
      }),
      finalizeDeletionJob,
      markDeletionJobFailure,
    })

    const response = await handleDeletionWorker(cronRequest(), runtime(repository))

    expect(response).toEqual({
      status: 503,
      body: {
        error: 'deletion_worker_incomplete',
        claimedCount: 1,
        completedCount: 0,
        requeuedCount: 1,
        failedCount: 0,
      },
    })
    expect(finalizeDeletionJob).not.toHaveBeenCalled()
    expect(markDeletionJobFailure).toHaveBeenCalledWith({
      market: 'jp',
      requestId: REQUEST_ID,
      claimToken: CLAIM_TOKEN,
      failureCode: 'voice_storage_delete_failed',
      failedAt: '2026-08-06T01:00:00.000Z',
      retryAt: '2026-08-06T01:05:00.000Z',
    })
    expect(JSON.stringify(response)).not.toContain('private storage provider response')
  })

  it('marks a finalize failure and never reports completion', async () => {
    const claimDeletionJob = vi
      .fn()
      .mockResolvedValueOnce({
        requestId: REQUEST_ID,
        claimToken: CLAIM_TOKEN,
        categories: ['telemetry'] as const,
        voiceStoragePaths: [],
        attemptCount: 1,
      })
      .mockResolvedValueOnce(null)
    const deleteVoiceStorageObjects = vi.fn(async () => undefined)
    const markDeletionJobFailure = vi.fn(async () => ({ status: 'failed' as const }))
    const repository = repositoryStub({
      claimDeletionJob,
      deleteVoiceStorageObjects,
      finalizeDeletionJob: vi.fn(async () => {
        throw new Error('database response body')
      }),
      markDeletionJobFailure,
    })

    const response = await handleDeletionWorker(cronRequest(), runtime(repository))

    expect(response).toMatchObject({
      status: 503,
      body: { completedCount: 0, requeuedCount: 0, failedCount: 1 },
    })
    expect(deleteVoiceStorageObjects).not.toHaveBeenCalled()
    expect(markDeletionJobFailure).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: 'database_finalize_failed' }),
    )
  })
})

describe('deletion repository adapter', () => {
  it('claims by server market, deletes exact storage paths, and finalizes by claim token', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              request_id: REQUEST_ID,
              claim_token: CLAIM_TOKEN,
              categories: ['voice'],
              voice_storage_paths: ['participant/voice.webm'],
              attempt_count: 1,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ completed: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    const repository = new SupabaseDataPlaneRepository({
      url: 'https://jp-project.supabase.co/',
      serviceRoleKey: 'service-role-key',
      fetchImpl,
    })

    const job = await repository.claimDeletionJob({
      market: 'jp',
      claimedAt: '2026-08-06T01:00:00.000Z',
      staleBefore: '2026-08-06T00:45:00.000Z',
    })
    await repository.deleteVoiceStorageObjects({
      bucket: 'haru-voice-jp',
      paths: job?.voiceStoragePaths ?? [],
    })
    await repository.finalizeDeletionJob({
      market: 'jp',
      requestId: REQUEST_ID,
      claimToken: CLAIM_TOKEN,
      completedAt: '2026-08-06T01:00:00.000Z',
      deletedVoiceStoragePaths: ['participant/voice.webm'],
    })

    expect(job).toEqual({
      requestId: REQUEST_ID,
      claimToken: CLAIM_TOKEN,
      categories: ['voice'],
      voiceStoragePaths: ['participant/voice.webm'],
      attemptCount: 1,
    })
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://jp-project.supabase.co/rest/v1/rpc/claim_deletion_job',
      'https://jp-project.supabase.co/storage/v1/object/haru-voice-jp',
      'https://jp-project.supabase.co/rest/v1/rpc/finalize_deletion_job',
    ])
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      p_market: 'jp',
      p_claimed_at: '2026-08-06T01:00:00.000Z',
      p_stale_before: '2026-08-06T00:45:00.000Z',
    })
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
      prefixes: ['participant/voice.webm'],
    })
  })
})

describe('deletion worker configuration', () => {
  it('loads server-only worker settings without accepting VITE substitutes', () => {
    const common = {
      HARU_MARKET: 'jp',
      SUPABASE_URL: 'https://jp-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      HARU_ENROLLMENT_CODE_PEPPER: 'pepper',
    }
    const configured = createRuntime({
      ...common,
      CRON_SECRET: WORKER_SECRET,
      HARU_VOICE_STORAGE_BUCKET: 'haru-voice-jp',
    })
    expect(configured).toMatchObject({
      ok: true,
      runtime: {
        config: {
          market: 'jp',
          deletionWorkerSecret: WORKER_SECRET,
          voiceStorageBucket: 'haru-voice-jp',
        },
      },
    })

    const viteOnly = createRuntime({
      ...common,
      VITE_CRON_SECRET: WORKER_SECRET,
      VITE_HARU_VOICE_STORAGE_BUCKET: 'wrong-bucket',
    })
    expect(viteOnly.ok).toBe(true)
    if (viteOnly.ok) {
      expect(viteOnly.runtime.config).not.toHaveProperty('deletionWorkerSecret')
      expect(viteOnly.runtime.config).not.toHaveProperty('voiceStorageBucket')
    }
  })

  it('documents env settings and schedules the internal endpoint', () => {
    const env = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')
    const apiEnv = readFileSync(resolve(process.cwd(), 'api/.env.example'), 'utf8')
    const vercel = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { crons?: Array<{ path: string; schedule: string }> }

    expect(env).toContain('CRON_SECRET=')
    expect(env).toContain('HARU_VOICE_STORAGE_BUCKET=')
    expect(env).toContain('HARU_COUNSELOR_API_SECRET=')
    expect(apiEnv).toContain('HARU_COUNSELOR_API_SECRET=')
    expect(apiEnv).toContain('CRON_SECRET=')
    expect(apiEnv).toContain('HARU_VOICE_STORAGE_BUCKET=')
    expect(vercel.crons).toContainEqual({
      path: '/api/internal/v1/deletions/process',
      schedule: '0 * * * *',
    })
  })
})
