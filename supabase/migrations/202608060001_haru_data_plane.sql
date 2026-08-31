-- Haru country-isolated data plane.
-- Apply this same migration to two separate projects. Set HARU_MARKET only in
-- the matching server deployment; never place a service-role key in VITE_*.

create extension if not exists pgcrypto;

create table public.data_plane_settings (
  singleton boolean primary key default true check (singleton),
  market text not null unique check (market in ('kr', 'jp')),
  configured_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('kr', 'jp')),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  write_fenced_at timestamptz,
  deleted_at timestamptz
);

create table public.participant_devices (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  device_token_hash text not null unique check (length(device_token_hash) = 64),
  installation_id text not null check (length(installation_id) between 1 and 100),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  unique (participant_id, installation_id)
);

create table public.enrollment_codes (
  code_hash text primary key check (length(code_hash) = 64),
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  consent_revision text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_device_id uuid references public.participant_devices(id)
);

create table public.consent_receipts (
  id bigint generated always as identity primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  revision text not null,
  grants jsonb not null,
  source text not null check (source in ('enrollment', 'settings', 'withdrawal', 'operator')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (jsonb_typeof(grants) = 'object')
);

create table public.routine_sessions (
  session_id text primary key check (session_id ~ '^routine_[a-f0-9]{32}$'),
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  content_pack_version text not null,
  consent_revision text not null,
  status text not null check (
    status in ('started', 'paused', 'resumed', 'exit_observed', 'completed', 'abandoned')
  ),
  started_at timestamptz not null,
  last_event_at timestamptz not null,
  completed_at timestamptz,
  last_question_instance_id text,
  progress_percent numeric(5, 2) not null default 0 check (
    progress_percent between 0 and 100
  ),
  active_duration_ms bigint not null default 0 check (active_duration_ms >= 0),
  wall_duration_ms bigint not null default 0 check (wall_duration_ms >= active_duration_ms),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_attempts (
  id bigint generated always as identity primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  session_id text not null references public.routine_sessions(session_id) on delete cascade,
  question_instance_id text not null check (question_instance_id ~ '^question_[a-f0-9]{32}$'),
  question_id text not null,
  question_type text not null,
  content_pack_version text not null,
  presented_at timestamptz not null,
  completed_at timestamptz,
  active_duration_ms bigint not null check (active_duration_ms >= 0),
  wall_duration_ms bigint not null check (wall_duration_ms >= active_duration_ms),
  first_interaction_ms bigint check (first_interaction_ms >= 0),
  confirmation_latency_ms bigint check (confirmation_latency_ms >= 0),
  response jsonb,
  received_at timestamptz not null default now(),
  unique (market, question_instance_id)
);

create table public.telemetry_events (
  event_id text not null unique check (event_id ~ '^evt_(kr|jp)_[a-f0-9]{32}$'),
  participant_id uuid not null references public.participants(id) on delete cascade,
  device_id uuid not null references public.participant_devices(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  locale text not null check (locale in ('ko-KR', 'ja-JP')),
  schema_version text not null,
  event_name text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  sequence bigint not null check (sequence >= 0),
  app_version text not null,
  content_pack_version text not null,
  installation_id text not null check (installation_id ~ '^inst_(kr|jp)_[a-f0-9]{32}$'),
  visit_id text not null check (visit_id ~ '^visit_[a-f0-9]{32}$'),
  routine_session_id text,
  question_instance_id text,
  route_id text not null,
  consent_revision text not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (event_id)
);

create table public.memory_items (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  semantic_codes text[] not null default '{}',
  content jsonb not null,
  sensitivity text not null default 'private' check (
    sensitivity in ('private', 'family', 'care_team')
  ),
  family_sharing boolean not null default false,
  content_pack_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voice_assets (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  question_instance_id text,
  storage_object_path text not null unique,
  mime_type text not null,
  duration_ms integer not null check (duration_ms between 0 and 3600000),
  transcript_id uuid references public.memory_items(id) on delete set null,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.caregiver_relationships (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  caregiver_user_id uuid not null,
  market text not null check (market in ('kr', 'jp')),
  role text not null check (role in ('caregiver', 'counselor')),
  share_scopes text[] not null default '{}',
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (participant_id, caregiver_user_id, role)
);

create table public.caregiver_observations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  relationship_id uuid not null references public.caregiver_relationships(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  domains jsonb not null,
  note_ciphertext text,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.access_audit (
  id bigint generated always as identity primary key,
  participant_id uuid references public.participants(id) on delete set null,
  actor_id uuid,
  market text not null check (market in ('kr', 'jp')),
  action text not null,
  resource_type text not null,
  resource_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.deletion_jobs (
  request_id uuid primary key,
  participant_id uuid references public.participants(id) on delete set null,
  market text not null check (market in ('kr', 'jp')),
  requester_device_token_hash text not null check (length(requester_device_token_hash) = 64),
  categories text[] not null,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed')
  ),
  requested_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claim_token uuid,
  failure_code text,
  receipt jsonb,
  check (
    cardinality(categories) > 0
    and categories <@ array[
      'profile', 'activity', 'memory', 'voice', 'caregiver', 'telemetry', 'all'
    ]::text[]
    and ('all' <> all(categories) or cardinality(categories) = 1)
  ),
  check ((status = 'processing') = (claim_token is not null and started_at is not null)),
  check (status <> 'completed' or (completed_at is not null and receipt is not null)),
  check (status <> 'failed' or (failed_at is not null and failure_code is not null))
);

create table public.daily_metrics (
  id bigint generated always as identity primary key,
  participant_id uuid references public.participants(id) on delete cascade,
  market text not null check (market in ('kr', 'jp')),
  metric_date date not null,
  metric_name text not null,
  metric_value numeric not null,
  dimensions jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (participant_id, metric_date, metric_name, dimensions)
);

create index telemetry_participant_occurred_idx
  on public.telemetry_events (participant_id, occurred_at desc);
create index telemetry_question_idx
  on public.telemetry_events (question_instance_id, occurred_at);
create index sessions_participant_started_idx
  on public.routine_sessions (participant_id, started_at desc);
create index attempts_session_idx
  on public.question_attempts (session_id, presented_at);
create index memory_participant_updated_idx
  on public.memory_items (participant_id, updated_at desc);
create index deletion_jobs_status_idx
  on public.deletion_jobs (market, status, next_attempt_at, requested_at);
create unique index deletion_jobs_one_processing_participant_idx
  on public.deletion_jobs (participant_id)
  where participant_id is not null and status = 'processing';

alter table public.participants enable row level security;
alter table public.data_plane_settings enable row level security;
alter table public.participant_devices enable row level security;
alter table public.enrollment_codes enable row level security;
alter table public.consent_receipts enable row level security;
alter table public.routine_sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.telemetry_events enable row level security;
alter table public.memory_items enable row level security;
alter table public.voice_assets enable row level security;
alter table public.caregiver_relationships enable row level security;
alter table public.caregiver_observations enable row level security;
alter table public.access_audit enable row level security;
alter table public.deletion_jobs enable row level security;
alter table public.daily_metrics enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create or replace function public.assert_data_plane_market(
  p_market text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.data_plane_settings s
     where s.singleton = true and s.market = p_market
  ) then
    raise exception 'data_plane_market_mismatch' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.authenticate_haru_device(
  p_market text,
  p_device_token_hash text,
  p_allow_fenced boolean default false
) returns table (participant_id uuid, device_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_data_plane_market(p_market);
  return query
    select p.id, d.id
      from public.participant_devices d
      join public.participants p on p.id = d.participant_id
     where d.market = p_market
       and p.market = p_market
       and d.device_token_hash = p_device_token_hash
       and d.revoked_at is null
       and d.expires_at > now()
       and p.deleted_at is null
       and (p_allow_fenced or p.write_fenced_at is null)
     limit 1
     for share of p;

  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.require_consent(
  p_participant_id uuid,
  p_grant text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select coalesce((c.grants ->> p_grant)::boolean, false)
    into v_allowed
    from public.consent_receipts c
   where c.participant_id = p_participant_id
   order by c.received_at desc, c.id desc
   limit 1;

  if coalesce(v_allowed, false) is not true then
    raise exception 'consent_required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.issue_enrollment_code(
  p_market text,
  p_code_hash text,
  p_issued_at timestamptz,
  p_expires_at timestamptz
) returns table (created boolean, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_inserted integer;
begin
  perform public.assert_data_plane_market(p_market);

  if p_issued_at is null
     or p_expires_at is null
     or length(p_code_hash) <> 64
     or p_code_hash !~ '^[a-f0-9]{64}$'
     or p_expires_at < p_issued_at + interval '5 minutes'
     or p_expires_at > p_issued_at + interval '7 days'
  then
    raise exception 'invalid_enrollment_code_request' using errcode = '22023';
  end if;

  insert into public.participants (market, profile, created_at, updated_at)
  values (p_market, '{}'::jsonb, p_issued_at, p_issued_at)
  returning id into v_participant_id;

  insert into public.enrollment_codes (
    code_hash, participant_id, market, consent_revision, created_at, expires_at
  ) values (
    p_code_hash, v_participant_id, p_market, 'pending', p_issued_at, p_expires_at
  )
  on conflict (code_hash) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    delete from public.participants where id = v_participant_id;
    return query select false, null::uuid;
    return;
  end if;

  return query select true, v_participant_id;
end;
$$;

create or replace function public.redeem_enrollment_code(
  p_market text,
  p_code_hash text,
  p_device_token_hash text,
  p_installation_id text,
  p_consent_revision text,
  p_redeemed_at timestamptz
) returns table (redeemed boolean, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.enrollment_codes%rowtype;
  v_device_id uuid;
begin
  perform public.assert_data_plane_market(p_market);
  select * into v_code
    from public.enrollment_codes
   where code_hash = p_code_hash
     and market = p_market
     and used_at is null
     and expires_at > p_redeemed_at
   for update;

  if not found then
    raise exception 'invalid_or_expired_enrollment_code' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.participants p
     where p.id = v_code.participant_id
       and (p.deleted_at is not null or p.write_fenced_at is not null)
  ) then
    raise exception 'invalid_or_expired_enrollment_code' using errcode = '28000';
  end if;

  insert into public.participant_devices (
    participant_id, market, device_token_hash, installation_id, created_at, last_seen_at
  ) values (
    v_code.participant_id, p_market, p_device_token_hash, p_installation_id,
    p_redeemed_at, p_redeemed_at
  )
  returning id into v_device_id;

  update public.enrollment_codes
     set used_at = p_redeemed_at, used_by_device_id = v_device_id
   where code_hash = p_code_hash;

  insert into public.consent_receipts (
    participant_id, market, revision, grants, source, occurred_at
  ) values (
    v_code.participant_id,
    p_market,
    p_consent_revision,
    jsonb_build_object(
      'usageAnalytics', false,
      'longitudinalActivity', false,
      'voiceCapture', false,
      'sttProcessing', false,
      'transcriptStorage', false,
      'audioStorage', false,
      'personalization', false,
      'familySharing', false
    ),
    'enrollment',
    p_redeemed_at
  );

  return query select true, v_code.participant_id;
end;
$$;

create or replace function public.record_consent_receipt(
  p_market text,
  p_device_token_hash text,
  p_revision text,
  p_grants jsonb,
  p_occurred_at timestamptz
) returns table (accepted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
begin
  select a.participant_id into v_participant_id
    from public.authenticate_haru_device(p_market, p_device_token_hash, false) a;

  insert into public.consent_receipts (
    participant_id, market, revision, grants, source, occurred_at
  ) values (
    v_participant_id, p_market, p_revision, p_grants, 'settings', p_occurred_at
  );

  return query select true;
end;
$$;

create or replace function public.ingest_telemetry_batch(
  p_market text,
  p_locale text,
  p_device_token_hash text,
  p_received_at timestamptz,
  p_events jsonb
) returns table (accepted_count integer, duplicate_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_device_id uuid;
  v_event jsonb;
  v_inserted integer := 0;
  v_total integer;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 50 then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;
  if (p_market = 'kr' and p_locale <> 'ko-KR')
    or (p_market = 'jp' and p_locale <> 'ja-JP') then
    raise exception 'invalid_market_locale' using errcode = '22023';
  end if;

  select a.participant_id, a.device_id into v_participant_id, v_device_id
    from public.authenticate_haru_device(p_market, p_device_token_hash, false) a;
  perform public.require_consent(v_participant_id, 'usageAnalytics');

  v_total := jsonb_array_length(p_events);
  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if (v_event ->> 'eventName') in (
      'sequence_changed',
      'pair_attempted',
      'answer_confirmed',
      'voice_capture_status',
      'drawing_progress'
    ) then
      perform public.require_consent(v_participant_id, 'longitudinalActivity');
    end if;
    if (v_event ->> 'eventName') = 'voice_capture_status' then
      perform public.require_consent(v_participant_id, 'voiceCapture');
    end if;
    if (v_event ->> 'eventId') !~ ('^evt_' || p_market || '_[a-f0-9]{32}$')
      or (v_event ->> 'installationId') <> (
        select d.installation_id from public.participant_devices d where d.id = v_device_id
      ) then
      raise exception 'invalid_event_identity' using errcode = '22023';
    end if;
    insert into public.telemetry_events (
      event_id, participant_id, device_id, market, locale, schema_version,
      event_name, occurred_at, received_at, sequence, app_version,
      content_pack_version, installation_id, visit_id, routine_session_id,
      question_instance_id, route_id, consent_revision, payload
    ) values (
      v_event ->> 'eventId',
      v_participant_id,
      v_device_id,
      p_market,
      p_locale,
      v_event ->> 'schemaVersion',
      v_event ->> 'eventName',
      (v_event ->> 'occurredAt')::timestamptz,
      p_received_at,
      (v_event ->> 'sequence')::bigint,
      v_event ->> 'appVersion',
      v_event ->> 'contentPackVersion',
      v_event ->> 'installationId',
      v_event ->> 'visitId',
      nullif(v_event ->> 'routineSessionId', ''),
      nullif(v_event ->> 'questionInstanceId', ''),
      v_event ->> 'routeId',
      v_event ->> 'consentRevision',
      coalesce(v_event -> 'payload', '{}'::jsonb)
    ) on conflict (event_id) do nothing;
    v_inserted := v_inserted + case when found then 1 else 0 end;
  end loop;

  update public.participant_devices
     set last_seen_at = p_received_at
   where id = v_device_id;

  return query select v_inserted, v_total - v_inserted;
end;
$$;

create or replace function public.record_activity_session(
  p_market text,
  p_device_token_hash text,
  p_received_at timestamptz,
  p_session jsonb
) returns table (accepted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
begin
  select a.participant_id into v_participant_id
    from public.authenticate_haru_device(p_market, p_device_token_hash, false) a;
  perform public.require_consent(v_participant_id, 'longitudinalActivity');

  insert into public.routine_sessions (
    session_id, participant_id, market, content_pack_version, consent_revision,
    status, started_at, last_event_at, completed_at, last_question_instance_id,
    progress_percent, active_duration_ms, wall_duration_ms, updated_at
  ) values (
    p_session ->> 'sessionId',
    v_participant_id,
    p_market,
    p_session ->> 'contentPackVersion',
    p_session ->> 'consentRevision',
    p_session ->> 'state',
    (p_session ->> 'occurredAt')::timestamptz,
    (p_session ->> 'occurredAt')::timestamptz,
    case when p_session ->> 'state' = 'completed'
      then (p_session ->> 'occurredAt')::timestamptz else null end,
    nullif(p_session ->> 'lastQuestionInstanceId', ''),
    (p_session ->> 'progressPercent')::numeric,
    (p_session ->> 'activeDurationMs')::bigint,
    (p_session ->> 'wallDurationMs')::bigint,
    p_received_at
  ) on conflict (session_id) do update set
    status = excluded.status,
    last_event_at = excluded.last_event_at,
    completed_at = coalesce(excluded.completed_at, public.routine_sessions.completed_at),
    last_question_instance_id = excluded.last_question_instance_id,
    progress_percent = greatest(public.routine_sessions.progress_percent, excluded.progress_percent),
    active_duration_ms = greatest(public.routine_sessions.active_duration_ms, excluded.active_duration_ms),
    wall_duration_ms = greatest(public.routine_sessions.wall_duration_ms, excluded.wall_duration_ms),
    updated_at = excluded.updated_at
  where public.routine_sessions.participant_id = v_participant_id
    and public.routine_sessions.market = p_market;

  if not found then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query select true;
end;
$$;

create or replace function public.record_question_attempt(
  p_market text,
  p_device_token_hash text,
  p_received_at timestamptz,
  p_attempt jsonb
) returns table (accepted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_session_id text := p_attempt ->> 'sessionId';
begin
  select a.participant_id into v_participant_id
    from public.authenticate_haru_device(p_market, p_device_token_hash, false) a;
  perform public.require_consent(v_participant_id, 'longitudinalActivity');

  if not exists (
    select 1 from public.routine_sessions s
     where s.session_id = v_session_id
       and s.participant_id = v_participant_id
       and s.market = p_market
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  insert into public.question_attempts (
    participant_id, market, session_id, question_instance_id, question_id,
    question_type, content_pack_version, presented_at, completed_at,
    active_duration_ms, wall_duration_ms, first_interaction_ms,
    confirmation_latency_ms, response, received_at
  ) values (
    v_participant_id,
    p_market,
    v_session_id,
    p_attempt ->> 'questionInstanceId',
    p_attempt ->> 'questionId',
    p_attempt ->> 'questionType',
    p_attempt ->> 'contentPackVersion',
    (p_attempt ->> 'presentedAt')::timestamptz,
    nullif(p_attempt ->> 'completedAt', '')::timestamptz,
    (p_attempt ->> 'activeDurationMs')::bigint,
    (p_attempt ->> 'wallDurationMs')::bigint,
    nullif(p_attempt ->> 'firstInteractionMs', '')::bigint,
    nullif(p_attempt ->> 'confirmationLatencyMs', '')::bigint,
    p_attempt -> 'response',
    p_received_at
  ) on conflict (market, question_instance_id) do nothing;

  return query select true;
end;
$$;

create or replace function public.export_participant_data(
  p_market text,
  p_device_token_hash text,
  p_categories text[],
  p_requested_at timestamptz
) returns table (generated_at timestamptz, data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_data jsonb := '{}'::jsonb;
begin
  select a.participant_id into v_participant_id
    from public.authenticate_haru_device(p_market, p_device_token_hash, false) a;

  if 'profile' = any(p_categories) then
    v_data := v_data || jsonb_build_object('profile', (
      select to_jsonb(p) - 'write_fenced_at' - 'deleted_at'
        from public.participants p where p.id = v_participant_id
    ));
  end if;
  if 'consents' = any(p_categories) then
    v_data := v_data || jsonb_build_object('consents', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.occurred_at)
        from public.consent_receipts c where c.participant_id = v_participant_id
    ), '[]'::jsonb));
  end if;
  if 'sessions' = any(p_categories) then
    v_data := v_data || jsonb_build_object('sessions', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.started_at)
        from public.routine_sessions s where s.participant_id = v_participant_id
    ), '[]'::jsonb));
  end if;
  if 'attempts' = any(p_categories) then
    v_data := v_data || jsonb_build_object('attempts', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.presented_at)
        from public.question_attempts a where a.participant_id = v_participant_id
    ), '[]'::jsonb));
  end if;
  if 'memory' = any(p_categories) then
    v_data := v_data || jsonb_build_object('memory', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
        from public.memory_items m where m.participant_id = v_participant_id
    ), '[]'::jsonb));
  end if;
  if 'caregiver' = any(p_categories) then
    v_data := v_data || jsonb_build_object('caregiverObservations', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.observed_at)
        from public.caregiver_observations o where o.participant_id = v_participant_id
    ), '[]'::jsonb));
  end if;
  if 'telemetry' = any(p_categories) then
    v_data := v_data || jsonb_build_object('telemetry', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.occurred_at)
        from public.telemetry_events t where t.participant_id = v_participant_id
    ), '[]'::jsonb));
  end if;

  insert into public.access_audit (
    participant_id, market, action, resource_type, occurred_at
  ) values (v_participant_id, p_market, 'export', 'participant_data', p_requested_at);

  return query select p_requested_at, v_data;
end;
$$;

create or replace function public.request_participant_deletion(
  p_market text,
  p_device_token_hash text,
  p_request_id uuid,
  p_categories text[],
  p_requested_at timestamptz
) returns table (request_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_categories text[];
begin
  select a.participant_id into v_participant_id
    from public.authenticate_haru_device(p_market, p_device_token_hash, true) a;

  select array_agg(distinct category order by category)
    into v_categories
    from unnest(p_categories) category;
  if coalesce(cardinality(v_categories), 0) = 0
    or not (v_categories <@ array[
      'profile', 'activity', 'memory', 'voice', 'caregiver', 'telemetry', 'all'
    ]::text[])
    or ('all' = any(v_categories) and cardinality(v_categories) <> 1) then
    raise exception 'invalid_deletion_categories' using errcode = '22023';
  end if;

  perform 1 from public.participants p
   where p.id = v_participant_id
     and p.market = p_market
     and p.deleted_at is null
   for update;
  if not found then raise exception 'unauthorized' using errcode = '42501'; end if;

  insert into public.deletion_jobs (
    request_id, participant_id, market, requester_device_token_hash,
    categories, status, requested_at, next_attempt_at
  ) values (
    p_request_id, v_participant_id, p_market, p_device_token_hash,
    v_categories, 'queued', p_requested_at, p_requested_at
  ) on conflict on constraint deletion_jobs_pkey do nothing;

  if not exists (
    select 1 from public.deletion_jobs d
     where d.request_id = p_request_id
       and d.participant_id = v_participant_id
       and d.market = p_market
       and d.requester_device_token_hash = p_device_token_hash
       and d.categories = v_categories
  ) then
    raise exception 'idempotency_conflict' using errcode = '23505';
  end if;

  update public.participants
     set write_fenced_at = coalesce(write_fenced_at, p_requested_at),
         updated_at = p_requested_at
   where id = v_participant_id;

  return query
    select d.request_id, d.status
      from public.deletion_jobs d
     where d.request_id = p_request_id;
end;
$$;

create or replace function public.get_participant_deletion_status(
  p_market text,
  p_device_token_hash text,
  p_request_id uuid
) returns table (
  request_id uuid,
  status text,
  requested_at timestamptz,
  completed_at timestamptz,
  expire_device_credential boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_data_plane_market(p_market);
  return query
    select d.request_id, d.status, d.requested_at, d.completed_at,
           'all' = any(d.categories)
      from public.deletion_jobs d
     where d.request_id = p_request_id
       and d.market = p_market
       and d.requester_device_token_hash = p_device_token_hash;

  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.claim_deletion_job(
  p_market text,
  p_claimed_at timestamptz,
  p_stale_before timestamptz
) returns table (
  request_id uuid,
  claim_token uuid,
  categories text[],
  voice_storage_paths text[],
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  perform public.assert_data_plane_market(p_market);

  select d.request_id into v_request_id
    from public.deletion_jobs d
   where d.market = p_market
     and d.participant_id is not null
     and (
       (d.status = 'queued' and d.next_attempt_at <= p_claimed_at)
       or (d.status = 'processing' and d.started_at <= p_stale_before)
     )
     and not exists (
       select 1 from public.deletion_jobs active
        where active.participant_id = d.participant_id
          and active.status = 'processing'
          and active.request_id <> d.request_id
     )
   order by
     case when d.status = 'processing' then 0 else 1 end,
     d.requested_at
   limit 1
   for update skip locked;

  if not found then return; end if;

  update public.deletion_jobs d
     set status = 'processing',
         started_at = p_claimed_at,
         claim_token = gen_random_uuid(),
         attempt_count = d.attempt_count + 1,
         failed_at = null
   where d.request_id = v_request_id;

  return query
    select d.request_id,
           d.claim_token,
           d.categories,
           case when 'voice' = any(d.categories) or 'all' = any(d.categories)
             then coalesce((
               select array_agg(v.storage_object_path order by v.storage_object_path)
                 from public.voice_assets v
                where v.participant_id = d.participant_id
                  and v.market = p_market
                  and v.deleted_at is null
             ), '{}'::text[])
             else '{}'::text[]
           end,
           d.attempt_count
      from public.deletion_jobs d
     where d.request_id = v_request_id;
end;
$$;

create or replace function public.finalize_deletion_job(
  p_market text,
  p_request_id uuid,
  p_claim_token uuid,
  p_completed_at timestamptz,
  p_deleted_voice_storage_paths text[]
) returns table (completed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.deletion_jobs%rowtype;
  v_expected_voice_paths text[] := '{}'::text[];
  v_confirmed_voice_paths text[] := '{}'::text[];
begin
  perform public.assert_data_plane_market(p_market);

  select d.* into v_job
    from public.deletion_jobs d
   where d.request_id = p_request_id
     and d.market = p_market
     and d.status = 'processing'
     and d.claim_token = p_claim_token
   for update;
  if not found then raise exception 'claim_lost' using errcode = '42501'; end if;
  if v_job.participant_id is null then
    raise exception 'claim_lost' using errcode = '42501';
  end if;

  if 'voice' = any(v_job.categories) or 'all' = any(v_job.categories) then
    select coalesce(array_agg(v.storage_object_path order by v.storage_object_path), '{}'::text[])
      into v_expected_voice_paths
      from public.voice_assets v
     where v.participant_id = v_job.participant_id
       and v.market = p_market
       and v.deleted_at is null;
  end if;
  select coalesce(array_agg(distinct path order by path), '{}'::text[])
    into v_confirmed_voice_paths
    from unnest(coalesce(p_deleted_voice_storage_paths, '{}'::text[])) path;
  if v_expected_voice_paths <> v_confirmed_voice_paths then
    raise exception 'storage_deletion_required' using errcode = '42501';
  end if;

  if 'all' = any(v_job.categories) then
    delete from public.access_audit a
     where a.participant_id = v_job.participant_id;
  else
    if 'activity' = any(v_job.categories) then
      delete from public.routine_sessions s
       where s.participant_id = v_job.participant_id and s.market = p_market;
      delete from public.daily_metrics m
       where m.participant_id = v_job.participant_id and m.market = p_market;
    end if;
    if 'memory' = any(v_job.categories) then
      delete from public.memory_items m
       where m.participant_id = v_job.participant_id and m.market = p_market;
    end if;
    if 'voice' = any(v_job.categories) then
      delete from public.voice_assets v
       where v.participant_id = v_job.participant_id and v.market = p_market;
    end if;
    if 'caregiver' = any(v_job.categories) then
      delete from public.caregiver_relationships r
       where r.participant_id = v_job.participant_id and r.market = p_market;
    end if;
    if 'telemetry' = any(v_job.categories) then
      delete from public.telemetry_events t
       where t.participant_id = v_job.participant_id and t.market = p_market;
    end if;
    if 'profile' = any(v_job.categories) then
      update public.participants p
         set profile = '{}'::jsonb,
             updated_at = p_completed_at
       where p.id = v_job.participant_id and p.market = p_market;
    end if;
  end if;

  update public.deletion_jobs d
     set status = 'completed',
         started_at = null,
         completed_at = p_completed_at,
         failed_at = null,
         claim_token = null,
         failure_code = null,
         next_attempt_at = p_completed_at,
         receipt = jsonb_build_object(
           'version', '1.0',
           'scope', v_job.categories,
           'completedAt', p_completed_at,
           'voiceObjectCount', cardinality(v_expected_voice_paths)
         )
   where d.request_id = p_request_id;

  insert into public.access_audit (
    participant_id, market, action, resource_type, resource_id, occurred_at, metadata
  ) values (
    null,
    p_market,
    'deletion_completed',
    'participant_data',
    p_request_id::text,
    p_completed_at,
    jsonb_build_object(
      'scope', v_job.categories,
      'voiceObjectCount', cardinality(v_expected_voice_paths)
    )
  );

  if 'all' = any(v_job.categories) then
    delete from public.participants p
     where p.id = v_job.participant_id and p.market = p_market;
  else
    update public.participants p
       set write_fenced_at = case when not exists (
             select 1 from public.deletion_jobs pending
              where pending.participant_id = v_job.participant_id
                and pending.request_id <> p_request_id
                and pending.status in ('queued', 'processing', 'failed')
           ) then null else p.write_fenced_at end,
           updated_at = p_completed_at
     where p.id = v_job.participant_id and p.market = p_market;
  end if;

  return query select true;
end;
$$;

create or replace function public.mark_deletion_job_failure(
  p_market text,
  p_request_id uuid,
  p_claim_token uuid,
  p_failure_code text,
  p_failed_at timestamptz,
  p_retry_at timestamptz
) returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.assert_data_plane_market(p_market);
  if p_failure_code not in (
    'voice_storage_delete_failed', 'database_finalize_failed'
  ) then
    raise exception 'invalid_failure_code' using errcode = '22023';
  end if;

  update public.deletion_jobs d
     set status = case when d.attempt_count >= 5 then 'failed' else 'queued' end,
         started_at = null,
         failed_at = case when d.attempt_count >= 5 then p_failed_at else null end,
         next_attempt_at = p_retry_at,
         claim_token = null,
         failure_code = p_failure_code
   where d.request_id = p_request_id
     and d.market = p_market
     and d.status = 'processing'
     and d.claim_token = p_claim_token
   returning d.status into v_status;
  if not found then raise exception 'claim_lost' using errcode = '42501'; end if;

  return query select v_status;
end;
$$;

revoke all on function public.assert_data_plane_market(text) from public, anon, authenticated;
revoke all on function public.authenticate_haru_device(text, text, boolean) from public, anon, authenticated;
revoke all on function public.require_consent(uuid, text) from public, anon, authenticated;
revoke all on function public.issue_enrollment_code(text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.redeem_enrollment_code(text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_consent_receipt(text, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.ingest_telemetry_batch(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.record_activity_session(text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.record_question_attempt(text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.export_participant_data(text, text, text[], timestamptz) from public, anon, authenticated;
revoke all on function public.request_participant_deletion(text, text, uuid, text[], timestamptz) from public, anon, authenticated;
revoke all on function public.get_participant_deletion_status(text, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_deletion_job(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_deletion_job(text, uuid, uuid, timestamptz, text[]) from public, anon, authenticated;
revoke all on function public.mark_deletion_job_failure(text, uuid, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

grant execute on function public.issue_enrollment_code(text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.redeem_enrollment_code(text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.record_consent_receipt(text, text, text, jsonb, timestamptz) to service_role;
grant execute on function public.ingest_telemetry_batch(text, text, text, timestamptz, jsonb) to service_role;
grant execute on function public.record_activity_session(text, text, timestamptz, jsonb) to service_role;
grant execute on function public.record_question_attempt(text, text, timestamptz, jsonb) to service_role;
grant execute on function public.export_participant_data(text, text, text[], timestamptz) to service_role;
grant execute on function public.request_participant_deletion(text, text, uuid, text[], timestamptz) to service_role;
grant execute on function public.get_participant_deletion_status(text, text, uuid) to service_role;
grant execute on function public.claim_deletion_job(text, timestamptz, timestamptz) to service_role;
grant execute on function public.finalize_deletion_job(text, uuid, uuid, timestamptz, text[]) to service_role;
grant execute on function public.mark_deletion_job_failure(text, uuid, uuid, text, timestamptz, timestamptz) to service_role;
