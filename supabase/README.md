# Haru country-separated Supabase setup

Use two independent Supabase projects with the same migration:

| Deployment | `HARU_MARKET` | Supabase region | Vercel function region |
| --- | --- | --- | --- |
| Korea | `kr` | Seoul (`ap-northeast-2`) | Seoul (`icn1`) |
| Japan | `jp` | Tokyo (`ap-northeast-1`) | Tokyo (`hnd1`) |

Configure the Vercel function region in each Vercel project. Do not add one
shared region to root `vercel.json`, because the same source deploys to both
countries.

Each Vercel project needs separate server-only values:

```text
HARU_MARKET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
HARU_ENROLLMENT_CODE_PEPPER
HARU_COUNSELOR_API_SECRET
CRON_SECRET
HARU_VOICE_STORAGE_BUCKET
```

Do not create `VITE_` versions. Service-role keys and enrollment pepper must
never enter the browser bundle, logs, screenshots, or client error payloads.

Each matching frontend build also needs its non-secret market value:

```text
# Korean project
VITE_HARU_MARKET=kr

# Japanese project
VITE_HARU_MARKET=jp
```

`VITE_HARU_MARKET` is intentionally public and must equal server-only
`HARU_MARKET`. It locks language and selects locale, currency, time zone,
speech language, content pack, and market-scoped browser storage. Do not set
`VITE_ALLOW_LANGUAGE_SWITCH=1` in production; that override is for local QA.

Apply `migrations/202608060001_haru_data_plane.sql` independently to both
projects. It creates RLS-enabled tables and revokes direct `anon` and
`authenticated` access. Same-origin functions call allowlisted,
`security definer` RPCs with the service role.

After migration, set the database's immutable market row once. Leave the table
empty until the correct project has been confirmed:

```sql
-- Japan project only
insert into public.data_plane_settings (singleton, market) values (true, 'jp');

-- Korea project only
insert into public.data_plane_settings (singleton, market) values (true, 'kr');
```

Do not use `on conflict do update` for this bootstrap. Every data RPC compares
server `HARU_MARKET` with this row and fails closed when missing or different.

Enrollment codes are eight uppercase characters using an unambiguous alphabet
that omits `I`, `O`, `0`, and `1`.
Administrative issuance stores only:

```text
SHA-256("<HARU_ENROLLMENT_CODE_PEPPER>:enrollment:<NORMALIZED_CODE>")
```

Codes target a participant in the same market, default to a 24-hour lifetime,
must expire within seven days, and are consumed under a row lock. Device tokens
use a separate hash domain:

```text
SHA-256("<HARU_ENROLLMENT_CODE_PEPPER>:device:<RAW_DEVICE_TOKEN>")
```

No cross-project replication, shared service key, shared participant table, or
automatic KR/JP identity link is part of this foundation.

## Deletion operation

The migration queues privacy deletions and immediately installs a participant
write fence. Root `vercel.json` schedules the secret-authenticated worker at
`/api/internal/v1/deletions/process` hourly. It:

1. claims queued jobs;
2. deletes selected database rows and private voice objects;
3. preserves only the minimal deletion receipt;
4. marks the job `completed` only after every store confirms removal;
5. retries failures without removing the write fence.

Current schema has no external RAG/vector inventory, so external RAG deletion
is not yet covered. Add participant-scoped references and deletion confirmation
before storing that state outside Supabase. Database integration and migration
execution require real project credentials; unit tests use repository doubles
and do not contact Supabase.
