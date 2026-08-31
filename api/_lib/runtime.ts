import { createHash, randomBytes, randomUUID } from 'node:crypto'

import type { HaruLocale, HaruMarket } from './contracts'
import {
  SupabaseDataPlaneRepository,
  type DataPlaneRepository,
} from './repository'

export interface DataPlaneConfig {
  market: HaruMarket
  locale: HaruLocale
  supabaseUrl: string
  supabaseServiceRoleKey: string
  enrollmentCodePepper: string
  deletionWorkerSecret?: string
  voiceStorageBucket?: string
  counselorApiSecret?: string
}

export interface DataPlaneRuntime {
  config: DataPlaneConfig
  repository: DataPlaneRepository
  now: () => Date
  randomId: () => string
  randomToken: () => string
  hashSecret: (value: string) => Promise<string>
}

type Environment = Record<string, string | undefined>

export type RuntimeResolution =
  | { ok: true; runtime: DataPlaneRuntime }
  | { ok: false; reason: 'data_plane_unavailable' }

function configured(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function strongSecret(value: string | undefined): value is string {
  return configured(value) && value.length >= 32 && value.length <= 256
}

export function createRuntime(environment: Environment): RuntimeResolution {
  const market = environment.HARU_MARKET
  const supabaseUrl = environment.SUPABASE_URL
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY
  const enrollmentCodePepper = environment.HARU_ENROLLMENT_CODE_PEPPER
  const deletionWorkerSecret = environment.CRON_SECRET
  const voiceStorageBucket = environment.HARU_VOICE_STORAGE_BUCKET
  const counselorApiSecret = environment.HARU_COUNSELOR_API_SECRET

  if (
    (market !== 'kr' && market !== 'jp') ||
    !configured(supabaseUrl) ||
    !configured(serviceRoleKey) ||
    !configured(enrollmentCodePepper)
  ) {
    return { ok: false, reason: 'data_plane_unavailable' }
  }

  const config: DataPlaneConfig = {
    market,
    locale: market === 'jp' ? 'ja-JP' : 'ko-KR',
    supabaseUrl,
    supabaseServiceRoleKey: serviceRoleKey,
    enrollmentCodePepper,
    ...(strongSecret(deletionWorkerSecret) ? { deletionWorkerSecret } : {}),
    ...(configured(voiceStorageBucket) ? { voiceStorageBucket } : {}),
    ...(strongSecret(counselorApiSecret) ? { counselorApiSecret } : {}),
  }

  return {
    ok: true,
    runtime: {
      config,
      repository: new SupabaseDataPlaneRepository({
        url: supabaseUrl,
        serviceRoleKey,
      }),
      now: () => new Date(),
      randomId: () => randomUUID(),
      randomToken: () => randomBytes(32).toString('base64url'),
      hashSecret: async (value) =>
        createHash('sha256')
          .update(`${enrollmentCodePepper}:${value}`)
          .digest('hex'),
    },
  }
}
