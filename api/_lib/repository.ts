import type {
  DeletionCategory,
  DeletionStatus,
  ExportCategory,
  ConsentGrants,
  HaruLocale,
  HaruMarket,
  ValidatedActivitySession,
  ValidatedQuestionAttempt,
  ValidatedTelemetryEvent,
} from './contracts'

export type RepositoryErrorCode =
  | 'unauthorized'
  | 'consent_required'
  | 'invalid_or_expired_enrollment_code'
  | 'not_found'
  | 'data_plane_unavailable'

export class DataPlaneRepositoryError extends Error {
  readonly code: RepositoryErrorCode

  constructor(code: RepositoryErrorCode) {
    super(code)
    this.name = 'DataPlaneRepositoryError'
    this.code = code
  }
}

export interface ClaimedDeletionJob {
  requestId: string
  claimToken: string
  categories: DeletionCategory[]
  voiceStoragePaths: string[]
  attemptCount: number
}

export interface DataPlaneRepository {
  issueEnrollmentCode(input: {
    market: HaruMarket
    codeHash: string
    issuedAt: string
    expiresAt: string
  }): Promise<
    | { created: false }
    | { created: true; participantId: string }
  >
  redeemEnrollmentCode(input: {
    market: HaruMarket
    codeHash: string
    deviceTokenHash: string
    installationId: string
    consentRevision: string
    redeemedAt: string
  }): Promise<{ redeemed: boolean; participantId?: string }>
  ingestTelemetry(input: {
    market: HaruMarket
    locale: HaruLocale
    deviceTokenHash: string
    receivedAt: string
    events: ValidatedTelemetryEvent[]
  }): Promise<{ acceptedCount: number; duplicateCount: number }>
  recordConsentReceipt(input: {
    market: HaruMarket
    deviceTokenHash: string
    revision: string
    grants: ConsentGrants
    occurredAt: string
  }): Promise<{ accepted: boolean }>
  recordActivitySession(input: {
    market: HaruMarket
    deviceTokenHash: string
    receivedAt: string
    session: ValidatedActivitySession
  }): Promise<{ accepted: boolean }>
  recordQuestionAttempt(input: {
    market: HaruMarket
    deviceTokenHash: string
    receivedAt: string
    attempt: ValidatedQuestionAttempt
  }): Promise<{ accepted: boolean }>
  exportParticipantData(input: {
    market: HaruMarket
    deviceTokenHash: string
    categories: ExportCategory[]
    requestedAt: string
  }): Promise<{ generatedAt: string; data: Record<string, unknown> }>
  requestParticipantDeletion(input: {
    market: HaruMarket
    deviceTokenHash: string
    requestId: string
    categories: DeletionCategory[]
    requestedAt: string
  }): Promise<{ requestId: string; status: DeletionStatus }>
  getParticipantDeletionStatus(input: {
    market: HaruMarket
    deviceTokenHash: string
    requestId: string
  }): Promise<{
    requestId: string
    status: DeletionStatus
    requestedAt: string
    completedAt: string | null
    deviceCredentialShouldExpire: boolean
  }>
  claimDeletionJob(input: {
    market: HaruMarket
    claimedAt: string
    staleBefore: string
  }): Promise<ClaimedDeletionJob | null>
  deleteVoiceStorageObjects(input: {
    bucket: string
    paths: string[]
  }): Promise<void>
  finalizeDeletionJob(input: {
    market: HaruMarket
    requestId: string
    claimToken: string
    completedAt: string
    deletedVoiceStoragePaths: string[]
  }): Promise<{ completed: true }>
  markDeletionJobFailure(input: {
    market: HaruMarket
    requestId: string
    claimToken: string
    failureCode: 'voice_storage_delete_failed' | 'database_finalize_failed'
    failedAt: string
    retryAt: string
  }): Promise<{ status: 'queued' | 'failed' }>
}

interface SupabaseRepositoryOptions {
  url: string
  serviceRoleKey: string
  fetchImpl?: typeof fetch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value) && isRecord(value[0])) return value[0]
  return isRecord(value) ? value : undefined
}

function isDeletionStatus(value: unknown): value is DeletionStatus {
  return (
    value === 'queued' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'failed'
  )
}

function isDeletionCategory(value: unknown): value is DeletionCategory {
  return (
    value === 'profile' ||
    value === 'activity' ||
    value === 'memory' ||
    value === 'voice' ||
    value === 'caregiver' ||
    value === 'telemetry' ||
    value === 'all'
  )
}

function isStorageObjectPath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 1024 ||
    value.startsWith('/') ||
    value.includes('\\')
  ) {
    return false
  }
  return value
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

function isStorageBucket(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value)
}

function repositoryErrorFromStatus(status: number, payload: unknown) {
  const message = firstRecord(payload)?.message
  const text = typeof message === 'string' ? message : ''
  if (text.includes('consent_required')) {
    return new DataPlaneRepositoryError('consent_required')
  }
  if (text.includes('invalid_or_expired_enrollment_code')) {
    return new DataPlaneRepositoryError('invalid_or_expired_enrollment_code')
  }
  if (status === 404 || text.includes('not_found')) {
    return new DataPlaneRepositoryError('not_found')
  }
  if (status === 401 || status === 403 || text.includes('unauthorized')) {
    return new DataPlaneRepositoryError('unauthorized')
  }
  return new DataPlaneRepositoryError('data_plane_unavailable')
}

export class SupabaseDataPlaneRepository implements DataPlaneRepository {
  private readonly url: string
  private readonly serviceRoleKey: string
  private readonly fetchImpl: typeof fetch

  constructor(options: SupabaseRepositoryOptions) {
    this.url = options.url.replace(/\/$/, '')
    this.serviceRoleKey = options.serviceRoleKey
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  private async rpc(name: string, parameters: Record<string, unknown>) {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: this.serviceRoleKey,
          authorization: `Bearer ${this.serviceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(parameters),
      })
    } catch {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok) throw repositoryErrorFromStatus(response.status, payload)
    return payload
  }

  async issueEnrollmentCode(
    input: Parameters<DataPlaneRepository['issueEnrollmentCode']>[0],
  ) {
    const row = firstRecord(
      await this.rpc('issue_enrollment_code', {
        p_market: input.market,
        p_code_hash: input.codeHash,
        p_issued_at: input.issuedAt,
        p_expires_at: input.expiresAt,
      }),
    )
    if (row?.created === false) return { created: false as const }
    if (row?.created !== true || typeof row.participant_id !== 'string') {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return {
      created: true as const,
      participantId: row.participant_id,
    }
  }

  async redeemEnrollmentCode(input: Parameters<DataPlaneRepository['redeemEnrollmentCode']>[0]) {
    const row = firstRecord(
      await this.rpc('redeem_enrollment_code', {
        p_market: input.market,
        p_code_hash: input.codeHash,
        p_device_token_hash: input.deviceTokenHash,
        p_installation_id: input.installationId,
        p_consent_revision: input.consentRevision,
        p_redeemed_at: input.redeemedAt,
      }),
    )
    return {
      redeemed: row?.redeemed === true,
      ...(typeof row?.participant_id === 'string'
        ? { participantId: row.participant_id }
        : {}),
    }
  }

  async ingestTelemetry(input: Parameters<DataPlaneRepository['ingestTelemetry']>[0]) {
    const row = firstRecord(
      await this.rpc('ingest_telemetry_batch', {
        p_market: input.market,
        p_locale: input.locale,
        p_device_token_hash: input.deviceTokenHash,
        p_received_at: input.receivedAt,
        p_events: input.events,
      }),
    )
    const acceptedCount = row?.accepted_count
    const duplicateCount = row?.duplicate_count
    if (
      !Number.isInteger(acceptedCount) ||
      !Number.isInteger(duplicateCount) ||
      Number(acceptedCount) < 0 ||
      Number(duplicateCount) < 0 ||
      Number(acceptedCount) + Number(duplicateCount) !== input.events.length
    ) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return {
      acceptedCount: Number(acceptedCount),
      duplicateCount: Number(duplicateCount),
    }
  }

  async recordConsentReceipt(input: Parameters<DataPlaneRepository['recordConsentReceipt']>[0]) {
    const row = firstRecord(
      await this.rpc('record_consent_receipt', {
        p_market: input.market,
        p_device_token_hash: input.deviceTokenHash,
        p_revision: input.revision,
        p_grants: input.grants,
        p_occurred_at: input.occurredAt,
      }),
    )
    if (row?.accepted !== true) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return { accepted: true }
  }

  async recordActivitySession(input: Parameters<DataPlaneRepository['recordActivitySession']>[0]) {
    const row = firstRecord(
      await this.rpc('record_activity_session', {
        p_market: input.market,
        p_device_token_hash: input.deviceTokenHash,
        p_received_at: input.receivedAt,
        p_session: input.session,
      }),
    )
    if (row?.accepted !== true) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return { accepted: true }
  }

  async recordQuestionAttempt(input: Parameters<DataPlaneRepository['recordQuestionAttempt']>[0]) {
    const row = firstRecord(
      await this.rpc('record_question_attempt', {
        p_market: input.market,
        p_device_token_hash: input.deviceTokenHash,
        p_received_at: input.receivedAt,
        p_attempt: input.attempt,
      }),
    )
    if (row?.accepted !== true) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return { accepted: true }
  }

  async exportParticipantData(input: Parameters<DataPlaneRepository['exportParticipantData']>[0]) {
    const row = firstRecord(
      await this.rpc('export_participant_data', {
        p_market: input.market,
        p_device_token_hash: input.deviceTokenHash,
        p_categories: input.categories,
        p_requested_at: input.requestedAt,
      }),
    )
    if (!row || !isRecord(row.data) || typeof row.generated_at !== 'string') {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return { generatedAt: row.generated_at, data: row.data }
  }

  async requestParticipantDeletion(input: Parameters<DataPlaneRepository['requestParticipantDeletion']>[0]) {
    const row = firstRecord(
      await this.rpc('request_participant_deletion', {
        p_market: input.market,
        p_device_token_hash: input.deviceTokenHash,
        p_request_id: input.requestId,
        p_categories: input.categories,
        p_requested_at: input.requestedAt,
      }),
    )
    if (!row || typeof row.request_id !== 'string' || !isDeletionStatus(row.status)) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return {
      requestId: row.request_id,
      status: row.status,
    }
  }

  async getParticipantDeletionStatus(input: Parameters<DataPlaneRepository['getParticipantDeletionStatus']>[0]) {
    const row = firstRecord(
      await this.rpc('get_participant_deletion_status', {
        p_market: input.market,
        p_device_token_hash: input.deviceTokenHash,
        p_request_id: input.requestId,
      }),
    )
    if (
      !row ||
      typeof row.request_id !== 'string' ||
      !isDeletionStatus(row.status) ||
      typeof row.requested_at !== 'string'
    ) {
      throw new DataPlaneRepositoryError('not_found')
    }
    return {
      requestId: row.request_id,
      status: row.status,
      requestedAt: row.requested_at,
      completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
      deviceCredentialShouldExpire: row.expire_device_credential === true,
    }
  }

  async claimDeletionJob(input: Parameters<DataPlaneRepository['claimDeletionJob']>[0]) {
    const row = firstRecord(
      await this.rpc('claim_deletion_job', {
        p_market: input.market,
        p_claimed_at: input.claimedAt,
        p_stale_before: input.staleBefore,
      }),
    )
    if (!row) return null
    const categories = row.categories
    const voiceStoragePaths = row.voice_storage_paths
    if (
      typeof row.request_id !== 'string' ||
      typeof row.claim_token !== 'string' ||
      !Array.isArray(categories) ||
      categories.length < 1 ||
      !categories.every(isDeletionCategory) ||
      !Array.isArray(voiceStoragePaths) ||
      !voiceStoragePaths.every(isStorageObjectPath) ||
      !Number.isInteger(row.attempt_count) ||
      Number(row.attempt_count) < 1
    ) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return {
      requestId: row.request_id,
      claimToken: row.claim_token,
      categories,
      voiceStoragePaths,
      attemptCount: Number(row.attempt_count),
    }
  }

  async deleteVoiceStorageObjects(
    input: Parameters<DataPlaneRepository['deleteVoiceStorageObjects']>[0],
  ) {
    if (
      !isStorageBucket(input.bucket) ||
      !input.paths.every(isStorageObjectPath)
    ) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    for (let offset = 0; offset < input.paths.length; offset += 100) {
      const prefixes = input.paths.slice(offset, offset + 100)
      let response: Response
      try {
        response = await this.fetchImpl(
          `${this.url}/storage/v1/object/${encodeURIComponent(input.bucket)}`,
          {
            method: 'DELETE',
            headers: {
              apikey: this.serviceRoleKey,
              authorization: `Bearer ${this.serviceRoleKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ prefixes }),
          },
        )
      } catch {
        throw new DataPlaneRepositoryError('data_plane_unavailable')
      }
      if (!response.ok) {
        throw new DataPlaneRepositoryError('data_plane_unavailable')
      }
    }
  }

  async finalizeDeletionJob(
    input: Parameters<DataPlaneRepository['finalizeDeletionJob']>[0],
  ) {
    const row = firstRecord(
      await this.rpc('finalize_deletion_job', {
        p_market: input.market,
        p_request_id: input.requestId,
        p_claim_token: input.claimToken,
        p_completed_at: input.completedAt,
        p_deleted_voice_storage_paths: input.deletedVoiceStoragePaths,
      }),
    )
    if (row?.completed !== true) {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return { completed: true as const }
  }

  async markDeletionJobFailure(
    input: Parameters<DataPlaneRepository['markDeletionJobFailure']>[0],
  ) {
    const row = firstRecord(
      await this.rpc('mark_deletion_job_failure', {
        p_market: input.market,
        p_request_id: input.requestId,
        p_claim_token: input.claimToken,
        p_failure_code: input.failureCode,
        p_failed_at: input.failedAt,
        p_retry_at: input.retryAt,
      }),
    )
    if (row?.status !== 'queued' && row?.status !== 'failed') {
      throw new DataPlaneRepositoryError('data_plane_unavailable')
    }
    return { status: row.status as 'queued' | 'failed' }
  }
}
