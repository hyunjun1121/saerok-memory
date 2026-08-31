import { describe, expect, it, vi } from 'vitest'

import {
  createRuntime,
  type DataPlaneRuntime,
} from '../_lib/runtime'
import type { DataPlaneRepository } from '../_lib/repository'
import {
  SupabaseDataPlaneRepository,
} from '../_lib/repository'
import type { ValidatedTelemetryEvent } from '../_lib/contracts'
import { handleTelemetryBatch } from '../telemetry/v1/batches'
import { handleEnrollmentRedeem } from '../enrollment/v1/redeem'
import { handleActivitySession } from '../activity/v1/sessions'
import { handleQuestionAttempt } from '../activity/v1/question-attempts'
import { handlePrivacyExport } from '../privacy/v1/exports'
import { handlePrivacyDeletion } from '../privacy/v1/deletions'
import { handlePrivacyDeletionStatus } from '../privacy/v1/deletions/[requestId]'
import { handleConsentReceipt } from '../privacy/v1/consents'

const DEVICE_TOKEN = 'device_token_with_enough_entropy_for_tests'
const EVENT_ID = 'evt_jp_00112233445566778899aabbccddeeff'
const SESSION_ID = 'routine_00112233445566778899aabbccddeeff'
const QUESTION_INSTANCE_ID = 'question_00112233445566778899aabbccddeeff'
const REQUEST_ID = '018f0f65-4f93-7cc0-9d41-4e63c8412866'
const INSTALLATION_ID = 'inst_jp_00112233445566778899aabbccddeeff'
const VISIT_ID = 'visit_00112233445566778899aabbccddeeff'

function repositoryStub(
  overrides: Partial<DataPlaneRepository> = {},
): DataPlaneRepository {
  return {
    issueEnrollmentCode: vi.fn(async () => ({
      created: true as const,
      participantId: 'participant-1',
    })),
    redeemEnrollmentCode: vi.fn(async () => ({
      redeemed: true,
      participantId: 'participant-1',
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
      data: { sessions: [] },
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
  repository = repositoryStub(),
  market: 'kr' | 'jp' = 'jp',
): DataPlaneRuntime {
  return {
    config: {
      market,
      locale: market === 'jp' ? 'ja-JP' : 'ko-KR',
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'server-only-key',
      enrollmentCodePepper: 'server-only-pepper',
    },
    repository,
    now: () => new Date('2026-08-06T00:00:00.000Z'),
    randomId: () => REQUEST_ID,
    randomToken: () => DEVICE_TOKEN,
    hashSecret: async (value) => `hashed:${value}`,
  }
}

function post(body: unknown, authorization = `Bearer ${DEVICE_TOKEN}`) {
  return {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body,
    query: {},
  }
}

function postWithDeviceCookie(body: unknown) {
  return {
    method: 'POST',
    headers: {
      cookie: `haru_device=${DEVICE_TOKEN}`,
      'content-type': 'application/json',
    },
    body,
    query: {},
  }
}

function validEvent(): ValidatedTelemetryEvent {
  return {
    schemaVersion: '1.0',
    eventId: EVENT_ID,
    eventName: 'question_completed',
    occurredAt: '2026-08-06T00:00:00.000Z',
    sequence: 4,
    appVersion: '1.0.0',
    contentPackVersion: 'jp-2026.08.1',
    installationId: INSTALLATION_ID,
    visitId: VISIT_ID,
    routineSessionId: 'routine_00112233445566778899aabbccddeeff',
    questionInstanceId: 'question_instance_7',
    routeId: '/lesson',
    consentRevision: '2026-08-01',
    payload: {
      attemptCount: 1,
      activeDurationMs: 3210,
      wallDurationMs: 4010,
      feedbackDurationMs: 500,
    },
  }
}

function telemetryBatch(events: unknown[]) {
  return { schemaVersion: '1.0', events }
}

describe('server runtime', () => {
  it('fails closed when server-only backend settings are absent', () => {
    expect(createRuntime({ HARU_MARKET: 'jp' })).toEqual({
      ok: false,
      reason: 'data_plane_unavailable',
    })
  })

  it('does not accept VITE variables as server credentials or market', () => {
    expect(
      createRuntime({
        VITE_HARU_MARKET: 'jp',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'leaked',
      }),
    ).toEqual({ ok: false, reason: 'data_plane_unavailable' })
  })
})

describe('Supabase repository adapter', () => {
  it('uses only the injected service key and maps consent failures without leaking details', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'consent_required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const repository = new SupabaseDataPlaneRepository({
      url: 'https://jp-project.supabase.co/',
      serviceRoleKey: 'server-service-role-key',
      fetchImpl,
    })

    await expect(
      repository.ingestTelemetry({
        market: 'jp',
        locale: 'ja-JP',
        deviceTokenHash: 'a'.repeat(64),
        receivedAt: '2026-08-06T00:00:00.000Z',
        events: [validEvent()],
      }),
    ).rejects.toMatchObject({
      code: 'consent_required',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://jp-project.supabase.co/rest/v1/rpc/ingest_telemetry_batch',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'server-service-role-key',
          authorization: 'Bearer server-service-role-key',
        }),
      }),
    )
  })

  it('does not acknowledge an event unless the RPC confirms every row or duplicate', async () => {
    const repository = new SupabaseDataPlaneRepository({
      url: 'https://jp-project.supabase.co',
      serviceRoleKey: 'server-service-role-key',
      fetchImpl: vi.fn(async () =>
        new Response(JSON.stringify([{ accepted_count: 0, duplicate_count: 0 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    })

    await expect(
      repository.ingestTelemetry({
        market: 'jp',
        locale: 'ja-JP',
        deviceTokenHash: 'a'.repeat(64),
        receivedAt: '2026-08-06T00:00:00.000Z',
        events: [validEvent()],
      }),
    ).rejects.toMatchObject({ code: 'data_plane_unavailable' })
  })
})

describe('POST /api/telemetry/v1/batches', () => {
  it('derives market and locale from server runtime and reports duplicates', async () => {
    const repository = repositoryStub({
      ingestTelemetry: vi.fn(async () => ({
        acceptedCount: 0,
        duplicateCount: 1,
      })),
    })
    const result = await handleTelemetryBatch(
      postWithDeviceCookie(telemetryBatch([validEvent()])),
      runtime(repository),
    )

    expect(result).toMatchObject({
      status: 202,
      body: {
        acceptedEventIds: [EVENT_ID],
        acceptedCount: 0,
        duplicateCount: 1,
      },
    })
    expect(repository.ingestTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        market: 'jp',
        locale: 'ja-JP',
        deviceTokenHash: `hashed:device:${DEVICE_TOKEN}`,
      }),
    )
  })

  it('rejects client market overrides and unknown event names', async () => {
    const event = validEvent() as unknown as Record<string, unknown>
    event.market = 'kr'
    const marketResult = await handleTelemetryBatch(
      post(telemetryBatch([event])),
      runtime(),
    )
    expect(marketResult).toMatchObject({
      status: 400,
      body: { error: 'client_market_forbidden' },
    })

    delete event.market
    event.eventName = 'raw_key_pressed'
    const eventResult = await handleTelemetryBatch(
      post(telemetryBatch([event])),
      runtime(),
    )
    expect(eventResult).toMatchObject({
      status: 400,
      body: { error: 'invalid_event' },
    })
  })

  it('rejects oversized batches and free-text payload fields', async () => {
    const tooMany = Array.from({ length: 51 }, validEvent)
    expect(
      await handleTelemetryBatch(post(telemetryBatch(tooMany)), runtime()),
    ).toMatchObject({ status: 413, body: { error: 'batch_too_large' } })

    const event = validEvent()
    const unsafeEvent = {
      ...event,
      payload: { ...event.payload, transcript: 'private words' },
    }
    expect(
      await handleTelemetryBatch(post(telemetryBatch([unsafeEvent])), runtime()),
    ).toMatchObject({
      status: 400,
      body: { error: 'invalid_event_payload' },
    })
  })

  it('accepts voice capture as an independent consent-change category', async () => {
    const event = {
      ...validEvent(),
      eventName: 'consent_changed' as const,
      routineSessionId: undefined,
      questionInstanceId: undefined,
      payload: {
        category: 'voice_capture',
        granted: false,
        source: 'settings',
      },
    }

    expect(
      await handleTelemetryBatch(post(telemetryBatch([event])), runtime()),
    ).toMatchObject({ status: 202 })
  })

  it('accepts bounded voice-experience codes and rejects unknown variants', async () => {
    const voiceEvent = {
      ...validEvent(),
      eventName: 'voice_capture_status' as const,
      payload: {
        phase: 'completed',
        permission: 'granted',
        durationMs: 12_000,
        sttStatus: 'completed',
        sttLatencyMs: 900,
        noSpeech: false,
        voiceExperienceVariant: 'assist_v2',
        waveformMode: 'reactive_red',
        guidanceCopyVersion: 'voice-guidance-2026-08-v2',
        sttPipelineVersion: 'haru-qwen3-asr-v2',
        outcomeReason: 'completed',
      },
    }
    expect(
      await handleTelemetryBatch(post(telemetryBatch([voiceEvent])), runtime()),
    ).toMatchObject({ status: 202 })

    const voiceExposureEvent = {
      ...validEvent(),
      eventName: 'question_presented' as const,
      payload: {
        questionId: 'D1_Q5',
        exerciseType: 'voice',
        domain: 'daily_memory',
        ordinal: 5,
        difficulty: '1',
        questionContentVersion: 'kr-2026.08',
        questionContentHash: 'fnv1a-voice0001',
        voiceExperienceVariant: 'assist_v2',
        waveformMode: 'reactive_red',
        guidanceCopyVersion: 'voice-guidance-2026-08-v2',
      },
    }
    expect(
      await handleTelemetryBatch(post(telemetryBatch([voiceExposureEvent])), runtime()),
    ).toMatchObject({ status: 202 })

    expect(
      await handleTelemetryBatch(
        post(
          telemetryBatch([
            {
              ...voiceExposureEvent,
              payload: {
                ...voiceExposureEvent.payload,
                voiceExperienceVariant: 'private_cohort',
              },
            },
          ]),
        ),
        runtime(),
      ),
    ).toMatchObject({ status: 400, body: { error: 'invalid_event_payload' } })

    expect(
      await handleTelemetryBatch(
        post(
          telemetryBatch([
            {
              ...voiceEvent,
              payload: { ...voiceEvent.payload, voiceExperienceVariant: 'private_cohort' },
            },
          ]),
        ),
        runtime(),
      ),
    ).toMatchObject({ status: 400, body: { error: 'invalid_event_payload' } })
  })
})

describe('enrollment, activity, and privacy contracts', () => {
  it('redeems an eight-character code once and stores the device token in an HttpOnly cookie', async () => {
    const repository = repositoryStub()
    const result = await handleEnrollmentRedeem(
      post(
        {
          code: 'ABCD2345',
          installationId: INSTALLATION_ID,
          consentRevision: '2026-08-01',
        },
        '',
      ),
      runtime(repository),
    )

    expect(result).toMatchObject({
      status: 200,
      body: {
        participantId: 'participant-1',
        market: 'jp',
      },
      headers: {
        'set-cookie': expect.stringContaining(
          `haru_device=${DEVICE_TOKEN}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`,
        ),
      },
    })
    expect(repository.redeemEnrollmentCode).toHaveBeenCalledWith(
      expect.objectContaining({
        codeHash: 'hashed:enrollment:ABCD2345',
        deviceTokenHash: `hashed:device:${DEVICE_TOKEN}`,
        market: 'jp',
      }),
    )
  })

  it('records bounded activity sessions and question attempts without raw media', async () => {
    const repository = repositoryStub()
    const sessionResult = await handleActivitySession(
      post({
        sessionId: SESSION_ID,
        state: 'started',
        occurredAt: '2026-08-06T00:00:00.000Z',
        contentPackVersion: 'jp-2026.08.1',
        consentRevision: '2026-08-01',
        progressPercent: 0,
        activeDurationMs: 0,
        wallDurationMs: 0,
      }),
      runtime(repository),
    )
    expect(sessionResult.status).toBe(202)

    const attemptResult = await handleQuestionAttempt(
      post({
        sessionId: SESSION_ID,
        questionInstanceId: QUESTION_INSTANCE_ID,
        questionId: 'D1_Q1',
        questionType: 'single_choice',
        contentPackVersion: 'jp-2026.08.1',
        presentedAt: '2026-08-06T00:00:00.000Z',
        completedAt: '2026-08-06T00:00:04.000Z',
        activeDurationMs: 3210,
        wallDurationMs: 4000,
        firstInteractionMs: 900,
        confirmationLatencyMs: 1200,
        response: {
          selectedOptionIds: ['choice_1'],
          isCorrect: true,
          retryCount: 0,
          hintCount: 0,
        },
      }),
      runtime(repository),
    )
    expect(attemptResult.status).toBe(202)
    expect(repository.recordQuestionAttempt).toHaveBeenCalledTimes(1)

    const unsafe = await handleQuestionAttempt(
      post({
        sessionId: SESSION_ID,
        questionInstanceId: QUESTION_INSTANCE_ID,
        questionId: 'D1_Q1',
        questionType: 'voice',
        contentPackVersion: 'jp-2026.08.1',
        presentedAt: '2026-08-06T00:00:00.000Z',
        activeDurationMs: 10,
        wallDurationMs: 10,
        transcript: 'must use the dedicated sensitive-data endpoint',
      }),
      runtime(repository),
    )
    expect(unsafe).toMatchObject({
      status: 400,
      body: { error: 'invalid_question_attempt' },
    })
  })

  it('exports selected categories and creates/checks idempotent deletion requests', async () => {
    const repository = repositoryStub()
    const exportResult = await handlePrivacyExport(
      post({ format: 'json', categories: ['consents', 'sessions'] }),
      runtime(repository),
    )
    expect(exportResult.status).toBe(200)

    const deletionResult = await handlePrivacyDeletion(
      post({
        requestId: REQUEST_ID,
        categories: ['activity', 'memory', 'voice'],
      }),
      runtime(repository),
    )
    expect(deletionResult).toMatchObject({
      status: 202,
      body: { requestId: REQUEST_ID, status: 'queued' },
    })

    const statusResult = await handlePrivacyDeletionStatus(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${DEVICE_TOKEN}` },
        body: undefined,
        query: { requestId: REQUEST_ID },
      },
      runtime(repository),
    )
    expect(statusResult).toMatchObject({
      status: 200,
      body: { requestId: REQUEST_ID, status: 'queued' },
    })
  })

  it('stores a complete consent snapshot and rejects partial grants', async () => {
    const repository = repositoryStub()
    const grants = {
      usageAnalytics: true,
      longitudinalActivity: true,
      voiceCapture: true,
      sttProcessing: false,
      transcriptStorage: false,
      audioStorage: false,
      personalization: false,
      familySharing: false,
    }
    const accepted = await handleConsentReceipt(
      post({
        revision: '2026-08-01',
        occurredAt: '2026-08-06T00:00:00.000Z',
        grants,
      }),
      runtime(repository),
    )
    expect(accepted).toMatchObject({ status: 202, body: { accepted: true } })
    expect(repository.recordConsentReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ market: 'jp', grants }),
    )

    const rejected = await handleConsentReceipt(
      post({
        revision: '2026-08-01',
        occurredAt: '2026-08-06T00:00:00.000Z',
        grants: { usageAnalytics: true },
      }),
      runtime(repository),
    )
    expect(rejected).toMatchObject({
      status: 400,
      body: { error: 'invalid_consent_receipt' },
    })
  })
})
