import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/202608060001_haru_data_plane.sql'),
  'utf8',
).toLowerCase()

describe('country-isolated Supabase schema', () => {
  it.each([
    'participants',
    'data_plane_settings',
    'participant_devices',
    'enrollment_codes',
    'consent_receipts',
    'routine_sessions',
    'question_attempts',
    'telemetry_events',
    'memory_items',
    'voice_assets',
    'caregiver_relationships',
    'caregiver_observations',
    'access_audit',
    'deletion_jobs',
    'daily_metrics',
  ])('creates and protects %s', (table) => {
    expect(migration).toContain(`create table public.${table}`)
    expect(migration).toContain(
      `alter table public.${table} enable row level security`,
    )
  })

  it('makes event and client request retries idempotent', () => {
    expect(migration).toMatch(/event_id text[^;]+unique/s)
    expect(migration).toContain('request_id uuid primary key')
    expect(migration).toContain('unique (market, question_instance_id)')
  })

  it('issues hash-only, expiring, single-use enrollment codes by server market', () => {
    expect(migration).toContain('function public.issue_enrollment_code')
    expect(migration).toContain('length(p_code_hash) <> 64')
    expect(migration).toContain("p_expires_at > p_issued_at + interval '7 days'")
    expect(migration).toContain('insert into public.enrollment_codes')
    expect(migration).toContain("p_code_hash, v_participant_id, p_market, 'pending'")
    expect(migration).toContain('used_at is null')
    expect(migration).not.toMatch(
      /create table public\.enrollment_codes[\s\S]*?\bcode text\b/,
    )
  })

  it.each([
    'redeem_enrollment_code',
    'issue_enrollment_code',
    'record_consent_receipt',
    'ingest_telemetry_batch',
    'record_activity_session',
    'record_question_attempt',
    'export_participant_data',
    'request_participant_deletion',
    'get_participant_deletion_status',
    'claim_deletion_job',
    'finalize_deletion_job',
    'mark_deletion_job_failure',
  ])('provides server-only RPC %s', (routine) => {
    expect(migration).toContain(`function public.${routine}`)
    expect(migration).toContain(
      `grant execute on function public.${routine}`,
    )
  })

  it('checks consent in storage RPCs and fences writes after deletion', () => {
    expect(migration).toContain('assert_data_plane_market(p_market)')
    expect(migration).toContain("require_consent(v_participant_id, 'usageanalytics')")
    expect(migration).toContain(
      "require_consent(v_participant_id, 'longitudinalactivity')",
    )
    expect(migration).toContain(
      "require_consent(v_participant_id, 'voicecapture')",
    )
    expect(migration).toContain("'voicecapture', false")
    expect(migration).toContain("'answer_confirmed'")
    expect(migration).toContain('write_fenced_at is not null')
    expect(migration).toContain('for share of p')
  })

  it('claims deletion work atomically and fences stale workers with a token', () => {
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain("status = 'processing'")
    expect(migration).toContain('started_at <= p_stale_before')
    expect(migration).toContain('claim_token = gen_random_uuid()')
    expect(migration).toContain('voice_storage_paths')
    expect(migration).toContain('storage_object_path')
  })

  it('finalizes category deletion only after storage acknowledgement', () => {
    expect(migration).toContain('p_deleted_voice_storage_paths text[]')
    expect(migration).toContain('v_expected_voice_paths <> v_confirmed_voice_paths')
    expect(migration).toContain("raise exception 'storage_deletion_required'")
    expect(migration).toContain('delete from public.voice_assets')
    expect(migration).toContain('delete from public.telemetry_events')
    expect(migration).toContain('delete from public.participants')
    expect(migration).toContain("status = 'completed'")
    expect(migration).toContain('receipt = jsonb_build_object')
    expect(migration).toContain("'deletion_completed'")
  })

  it('requeues bounded failures without marking deletion complete', () => {
    expect(migration).toContain('attempt_count')
    expect(migration).toContain('next_attempt_at')
    expect(migration).toContain("status = case when d.attempt_count >= 5 then 'failed' else 'queued' end")
    expect(migration).toContain('failure_code = p_failure_code')
  })
})
