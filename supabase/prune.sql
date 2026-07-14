-- Manual database prune for TriageDesk.
--
-- Run this by hand in the Supabase SQL editor (or `supabase db execute`) whenever
-- you want to tidy up. It is NOT scheduled and NOT required for the free tier:
-- normal usage takes decades to approach the 500 MB limit. This only removes
-- genuinely dead data — never tickets, requests, or ticket_activity (audit log).
--
-- Everything here is idempotent and safe to re-run. Adjust the retention windows
-- (the `interval` values) to taste. Run the PREVIEW section first if you want to
-- see how many rows each step would remove before committing.

-- ── PREVIEW (read-only) ─────────────────────────────────────────────────────
-- Uncomment to see what the DELETEs below would affect, without changing anything.
--
-- select 'orphaned_workspaces' as target, count(*) as rows
--   from workspaces w
--   where not exists (select 1 from workspace_members m where m.workspace_id = w.id)
--     and w.id <> '00000000-0000-4000-8000-000000000001'  -- keep the Demo workspace
-- union all
-- select 'stale_read_notifications', count(*)
--   from notifications
--   where read_at is not null and read_at < now() - interval '90 days'
-- union all
-- select 'dead_invites', count(*)
--   from workspace_invites
--   where (used_at is not null or revoked_at is not null
--          or (expires_at is not null and expires_at < now()))
--     and created_at < now() - interval '30 days'
--     and code <> 'DEMO-CLINIC-2026'  -- keep the seeded demo invite
-- union all
-- select 'stale_rate_limits', count(*)
--   from security_rate_limits
--   where updated_at < now() - interval '7 days';

-- ── 1. Orphaned workspaces (0 members) ──────────────────────────────────────
-- A workspace with no members is unreachable in the app (RLS requires membership),
-- so it is dead data. Deleting the row cascades to every child table
-- (requests, tickets, ai_triage_results, ticket_activity, ticket_notes,
-- departments, invites, metadata, notifications, request_attachments).
-- NOTE: this does NOT delete storage-bucket files. Only orphaned workspaces with
-- zero attachments are safe to prune here; the app's delete-workspace flow is what
-- clears storage. Verify request_attachments = 0 before relying on this in bulk.
delete from workspaces w
where not exists (select 1 from workspace_members m where m.workspace_id = w.id)
  and w.id <> '00000000-0000-4000-8000-000000000001'  -- keep the Demo workspace
  and not exists (select 1 from request_attachments a where a.workspace_id = w.id);

-- ── 2. Stale read notifications (older than 90 days, already read) ───────────
-- Unread notifications are always kept. The bell only hydrates the latest 15, so
-- old read rows are pure history and safe to drop.
delete from notifications
where read_at is not null
  and read_at < now() - interval '90 days';

-- ── 3. Dead workspace invites (used / revoked / expired, older than 30 days) ─
-- Active invites are never touched; the app already caps active invites at 5.
delete from workspace_invites
where (
    used_at is not null
    or revoked_at is not null
    or (expires_at is not null and expires_at < now())
  )
  and created_at < now() - interval '30 days'
  and code <> 'DEMO-CLINIC-2026';  -- keep the seeded demo invite

-- ── 4. Stale rate-limit rows (older than 7 days) ────────────────────────────
-- The check_rate_limit RPC already GC's these on every call; this is only a
-- backstop for scopes that have gone completely quiet.
delete from security_rate_limits
where updated_at < now() - interval '7 days';

-- ── 5. (OPTIONAL, DISABLED) Trim ticket_activity audit log ──────────────────
-- ticket_activity is the fastest-growing table (~6 rows per ticket) and is the
-- highest-leverage thing to trim IF you ever grow 100x. It is an AUDIT LOG, so
-- pruning it loses the granular "who did what when" history on tickets that still
-- exist. Both options below are commented out — enable only ONE, deliberately.
-- Neither touches tickets, requests, or notes; only the activity rows themselves.
--
-- Option A — time-based: drop activity older than 12 months.
-- delete from ticket_activity
-- where created_at < now() - interval '12 months';
--
-- Option B — per-ticket cap: keep only the latest 20 activity rows per ticket
-- (rows not attached to a ticket, e.g. request-only events, are left untouched).
-- delete from ticket_activity ta
-- using (
--   select id from (
--     select id,
--            row_number() over (partition by ticket_id order by created_at desc) as rn
--     from ticket_activity
--     where ticket_id is not null
--   ) ranked
--   where rn > 20
-- ) stale
-- where ta.id = stale.id;

-- Optional: reclaim disk after a large prune. Postgres reuses freed space for new
-- rows automatically; run this only if you need the file size to physically shrink.
-- vacuum (analyze) notifications, workspace_invites, security_rate_limits;
