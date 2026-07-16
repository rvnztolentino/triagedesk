-- Identity is owned by Clerk. `id` is an app-generated uuid (kept as the stable
-- primary key every other table FKs to), and `clerk_user_id` maps the Clerk user
-- (`user_...`) to that row. Auth is no longer backed by Supabase `auth.users`, so
-- there is no foreign key to it.
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'requester' check (role in ('requester', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration for databases created before the Clerk migration: give `id` its own
-- default, drop the legacy `auth.users` foreign key, and add the Clerk id mapping.
alter table user_profiles add column if not exists clerk_user_id text;
do $$
begin
  alter table user_profiles alter column id set default gen_random_uuid();
  if exists (select 1 from pg_constraint where conname = 'user_profiles_id_fkey') then
    alter table user_profiles drop constraint user_profiles_id_fkey;
  end if;
end $$;
create unique index if not exists user_profiles_clerk_user_id_key on user_profiles (clerk_user_id);

do $$
begin
  alter table user_profiles drop constraint if exists user_profiles_role_check;
  alter table user_profiles add constraint user_profiles_role_check check (role in ('requester', 'admin', 'owner'));
end $$;

-- Two-factor was removed; drop the column idempotently on existing databases.
alter table user_profiles drop column if exists two_factor_enabled;

-- Display-name change throttling (max 2 per rolling 3 months). window_start marks
-- the first change in the active window; the app resets the count once the window
-- elapses. Kept here rather than in security_rate_limits, whose rows are GC'd after
-- 7 days, which would silently reset a 3-month window.
alter table user_profiles add column if not exists name_change_count integer not null default 0;
alter table user_profiles add column if not exists name_change_window_start timestamptz;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists departments (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  description text not null default '',
  primary key (workspace_id, id)
);

insert into workspaces (id, name, slug, created_by)
values ('00000000-0000-4000-8000-000000000001', 'Demo Clinic', 'demo-clinic', null)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug;

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role text not null default 'requester' check (role in ('requester', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code text not null unique,
  role text not null default 'requester' check (role in ('requester', 'admin')),
  created_by uuid references user_profiles(id) on delete cascade,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  is_reusable boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requester_user_id uuid references user_profiles(id) on delete set null,
  description text not null,
  location text not null,
  contact_name text not null default '',
  urgency_note text not null default '',
  image_url text,
  status text not null check (status in ('needs-review', 'approved', 'rejected', 'duplicate')),
  duplicate_of_ticket_id text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists ai_triage_results (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  request_id text not null references requests(id) on delete cascade,
  source text not null check (source in ('rules', 'groq')),
  title text not null,
  category text not null,
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  department text not null,
  summary text not null,
  priority_reasoning text not null,
  similar_ticket_ids text[] not null default '{}',
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  request_id text references requests(id),
  requester_user_id uuid references user_profiles(id) on delete set null,
  title text not null,
  description text not null,
  location text not null,
  contact_name text not null default '',
  urgency_note text not null default '',
  status text not null check (status in ('new', 'open', 'in-progress', 'resolved', 'closed')),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  department text not null,
  category text not null,
  triage_summary text not null,
  priority_reasoning text not null,
  resolution_notes text not null default '',
  duplicate_of_ticket_id text references tickets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create table if not exists ticket_activity (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ticket_id text references tickets(id) on delete cascade,
  request_id text references requests(id) on delete cascade,
  action text not null,
  actor text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists ticket_notes (
  id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ticket_id text not null references tickets(id) on delete cascade,
  actor text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_metadata (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (workspace_id, key)
);

create table if not exists request_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  request_id text not null references requests(id) on delete cascade,
  file_name text not null default 'Attachment',
  storage_path text not null,
  public_url text,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

-- Per-recipient in-app notifications. Each row targets a single workspace member
-- (user_id) and is delivered/read independently. `link` is a workspace-relative
-- path (e.g. '/tickets/TRG-1042') resolved against the active workspace in the UI.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  actor text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table requests add column if not exists requester_user_id uuid references user_profiles(id) on delete set null;
alter table tickets add column if not exists requester_user_id uuid references user_profiles(id) on delete set null;
alter table requests add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table ai_triage_results add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table tickets add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table ticket_activity add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table ticket_notes add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table workspace_metadata add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table workspace_invites add column if not exists revoked_at timestamptz;
alter table workspace_invites add column if not exists is_reusable boolean not null default false;
alter table workspace_invites alter column created_by drop not null;
alter table departments add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table request_attachments add column if not exists file_name text not null default 'Attachment';

-- Retire the ticket-level 'needs-review' status (review is a request-stage concept).
-- Migrate any existing rows, then tighten the status check constraint. Idempotent.
update tickets set status = 'open' where status = 'needs-review';
alter table tickets drop constraint if exists tickets_status_check;
alter table tickets add constraint tickets_status_check check (status in ('new', 'open', 'in-progress', 'resolved', 'closed'));

update departments set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;

alter table departments alter column workspace_id set not null;

do $$
declare
  dependent_constraint record;
begin
  alter table ai_triage_results drop constraint if exists ai_triage_results_department_fkey;
  alter table tickets drop constraint if exists tickets_department_fkey;

  for dependent_constraint in
    select conrelid::regclass as table_name, conname
    from pg_constraint
    where contype = 'f'
      and confrelid = 'departments'::regclass
  loop
    execute format(
      'alter table %s drop constraint if exists %I',
      dependent_constraint.table_name,
      dependent_constraint.conname
    );
  end loop;

  alter table departments drop constraint if exists departments_pkey;
  alter table departments add primary key (workspace_id, id);
end $$;

-- Normalize the ai_triage_results.source check so existing deployments (whose
-- constraint may predate the rules fallback and only allow 'groq') accept both
-- the rules-based and Groq-based triage sources. Idempotent on re-run.
alter table ai_triage_results drop constraint if exists ai_triage_results_source_check;
alter table ai_triage_results
  add constraint ai_triage_results_source_check check (source in ('rules', 'groq'));

delete from workspace_invites
where id = '00000000-0000-4000-8000-000000000002'
  or code = 'DEMO-SCHOOL-2026';

insert into workspace_invites (
  id,
  workspace_id,
  code,
  role,
  created_by,
  expires_at,
  used_at,
  revoked_at,
  is_reusable
) values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'DEMO-CLINIC-2026',
  'requester',
  null,
  null,
  null,
  null,
  true
)
on conflict (code) do update set
  workspace_id = excluded.workspace_id,
  role = excluded.role,
  created_by = excluded.created_by,
  expires_at = excluded.expires_at,
  used_at = excluded.used_at,
  revoked_at = excluded.revoked_at,
  is_reusable = excluded.is_reusable;

update requests set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update ai_triage_results set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update tickets set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update ticket_activity set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update ticket_notes set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update workspace_metadata set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;

alter table requests alter column workspace_id set not null;
alter table ai_triage_results alter column workspace_id set not null;
alter table tickets alter column workspace_id set not null;
alter table ticket_activity alter column workspace_id set not null;
alter table ticket_notes alter column workspace_id set not null;
alter table workspace_metadata alter column workspace_id set not null;

do $$
begin
  alter table workspace_metadata drop constraint if exists workspace_metadata_pkey;
  alter table workspace_metadata add primary key (workspace_id, key);
end $$;

insert into departments (workspace_id, id, name, description)
select w.id, seed.id, seed.name, seed.description
from workspaces w
cross join (
  values
    ('it', 'IT', 'Network, devices, software, projectors, printers, accounts.'),
    ('facilities', 'Facilities', 'General building operations and space coordination.'),
    ('maintenance', 'Maintenance', 'HVAC, leaks, electrical, plumbing, repairs.'),
    ('security', 'Security', 'Access control, doors, gates, badges, incidents.'),
    ('admin', 'Admin', 'Records, scheduling, office supplies, front desk operations.'),
    ('clinic', 'Clinic / Health', 'Patient areas, health concerns, medical rooms, clinical workflow support.')
) as seed(id, name, description)
on conflict (workspace_id, id) do update set
  name = excluded.name,
  description = excluded.description;

with used_departments as (
  select workspace_id, department from ai_triage_results where nullif(trim(department), '') is not null
  union
  select workspace_id, department from tickets where nullif(trim(department), '') is not null
)
insert into departments (workspace_id, id, name, description)
select
  workspace_id,
  department,
  initcap(replace(department, '-', ' ')),
  'Imported from existing workspace records.'
from used_departments
on conflict (workspace_id, id) do nothing;

create index if not exists requests_status_created_at_idx on requests (status, created_at desc);
create unique index if not exists requests_workspace_id_id_idx on requests (workspace_id, id);
create index if not exists requests_workspace_status_created_at_idx on requests (workspace_id, status, created_at desc);
create index if not exists requests_requester_created_at_idx on requests (requester_user_id, created_at desc);
create index if not exists tickets_status_created_at_idx on tickets (status, created_at desc);
create unique index if not exists tickets_workspace_id_id_idx on tickets (workspace_id, id);
-- One approved request maps to at most one ticket. This blocks duplicate tickets
-- from concurrent approvals (TOCTOU on the read-then-insert in approveRequest).
create unique index if not exists tickets_workspace_request_unique_idx on tickets (workspace_id, request_id) where request_id is not null;
create index if not exists tickets_workspace_status_created_at_idx on tickets (workspace_id, status, created_at desc);
create index if not exists tickets_requester_created_at_idx on tickets (requester_user_id, created_at desc);
create index if not exists ai_triage_results_workspace_request_created_at_idx on ai_triage_results (workspace_id, request_id, created_at desc);
create index if not exists ticket_activity_ticket_created_at_idx on ticket_activity (ticket_id, created_at desc);
create index if not exists ticket_activity_workspace_created_at_idx on ticket_activity (workspace_id, created_at desc);
create index if not exists ticket_notes_ticket_created_at_idx on ticket_notes (ticket_id, created_at desc);
create index if not exists ticket_notes_workspace_ticket_created_at_idx on ticket_notes (workspace_id, ticket_id, created_at desc);
create index if not exists user_profiles_role_created_at_idx on user_profiles (role, created_at desc);
create index if not exists workspace_members_user_created_at_idx on workspace_members (user_id, created_at);
create index if not exists workspace_invites_workspace_created_at_idx on workspace_invites (workspace_id, created_at desc);
create index if not exists departments_workspace_name_idx on departments (workspace_id, name);
create index if not exists request_attachments_workspace_request_created_at_idx on request_attachments (workspace_id, request_id, created_at desc);
create index if not exists notifications_user_workspace_created_at_idx on notifications (user_id, workspace_id, created_at desc);
create index if not exists notifications_user_workspace_unread_idx on notifications (user_id, workspace_id) where read_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_triage_results_workspace_request_fkey') then
    alter table ai_triage_results
      add constraint ai_triage_results_workspace_request_fkey
      foreign key (workspace_id, request_id) references requests(workspace_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tickets_workspace_request_fkey') then
    alter table tickets
      add constraint tickets_workspace_request_fkey
      foreign key (workspace_id, request_id) references requests(workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_triage_results_workspace_department_fkey') then
    alter table ai_triage_results
      add constraint ai_triage_results_workspace_department_fkey
      foreign key (workspace_id, department) references departments(workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tickets_workspace_department_fkey') then
    alter table tickets
      add constraint tickets_workspace_department_fkey
      foreign key (workspace_id, department) references departments(workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticket_activity_workspace_ticket_fkey') then
    alter table ticket_activity
      add constraint ticket_activity_workspace_ticket_fkey
      foreign key (workspace_id, ticket_id) references tickets(workspace_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticket_activity_workspace_request_fkey') then
    alter table ticket_activity
      add constraint ticket_activity_workspace_request_fkey
      foreign key (workspace_id, request_id) references requests(workspace_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticket_notes_workspace_ticket_fkey') then
    alter table ticket_notes
      add constraint ticket_notes_workspace_ticket_fkey
      foreign key (workspace_id, ticket_id) references tickets(workspace_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'request_attachments_workspace_request_fkey') then
    alter table request_attachments
      add constraint request_attachments_workspace_request_fkey
      foreign key (workspace_id, request_id) references requests(workspace_id, id) on delete cascade;
  end if;
end $$;

-- Supabase no longer exposes new public tables to PostgREST/GraphQL by default.
-- Keep these grants in sync when adding app tables above.
grant usage on schema public to authenticated, service_role;

grant select on table user_profiles to authenticated;

grant select, insert, update, delete on table departments to authenticated;
grant select, insert, update, delete on table workspaces to authenticated;
grant select, insert, update, delete on table workspace_members to authenticated;
grant select, insert, update, delete on table workspace_invites to authenticated;
grant select, insert, update, delete on table requests to authenticated;
grant select, insert, update, delete on table ai_triage_results to authenticated;
grant select, insert, update, delete on table tickets to authenticated;
grant select, insert, delete on table ticket_activity to authenticated;
grant select, insert, update, delete on table ticket_notes to authenticated;
grant select, insert, delete on table request_attachments to authenticated;
grant select, insert, update, delete on table workspace_metadata to authenticated;
grant select, update, delete on table notifications to authenticated;

grant select, insert, update, delete on table
  user_profiles,
  workspaces,
  departments,
  workspace_members,
  workspace_invites,
  requests,
  ai_triage_results,
  tickets,
  ticket_activity,
  ticket_notes,
  workspace_metadata,
  request_attachments,
  notifications
to service_role;

create table if not exists security_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null default now(),
  usage_count bigint not null default 0 check (usage_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index if not exists security_rate_limits_updated_at_idx on security_rate_limits (updated_at);

alter table security_rate_limits enable row level security;

grant select, insert, update, delete on table security_rate_limits to service_role;

create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

create or replace function can_create_workspace_invite(target_workspace_id uuid, target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_role in ('requester', 'admin')
    and (
      has_workspace_role(target_workspace_id, array['owner'])
      or (
        target_role = 'requester'
        and has_workspace_role(target_workspace_id, array['admin'])
      )
    );
$$;

create or replace function can_remove_workspace_member(target_workspace_id uuid, target_member_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members actor
    join workspace_members target on target.workspace_id = actor.workspace_id
    where actor.workspace_id = target_workspace_id
      and actor.user_id = auth.uid()
      and target.user_id = target_member_user_id
      and target.user_id <> actor.user_id
      and (
        actor.role = 'owner'
        or (actor.role = 'admin' and target.role = 'requester')
      )
  );
$$;

create or replace function create_workspace_with_owner(target_name text, target_slug text, target_user_id uuid)
returns table (workspace_id uuid, workspace_name text, workspace_slug text, membership_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_workspace workspaces%rowtype;
begin
  if nullif(trim(target_name), '') is null then
    raise exception 'Workspace name is required.';
  end if;

  if target_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Workspace slug is invalid.';
  end if;

  insert into workspaces (name, slug, created_by)
  values (trim(target_name), target_slug, target_user_id)
  returning * into created_workspace;

  insert into workspace_members (workspace_id, user_id, role)
  values (created_workspace.id, target_user_id, 'owner');

  insert into departments (workspace_id, id, name, description) values
    (created_workspace.id, 'it', 'IT', 'Network, devices, software, projectors, printers, accounts.'),
    (created_workspace.id, 'facilities', 'Facilities', 'General building operations and space coordination.'),
    (created_workspace.id, 'maintenance', 'Maintenance', 'HVAC, leaks, electrical, plumbing, repairs.'),
    (created_workspace.id, 'security', 'Security', 'Access control, doors, gates, badges, incidents.'),
    (created_workspace.id, 'admin', 'Admin', 'Records, scheduling, office supplies, front desk operations.'),
    (created_workspace.id, 'clinic', 'Clinic / Health', 'Patient areas, health concerns, medical rooms, clinical workflow support.');

  return query
    select created_workspace.id, created_workspace.name, created_workspace.slug, 'owner'::text;
end;
$$;

create or replace function join_workspace_by_invite(target_workspace_slug text, target_invite_code text, target_user_id uuid)
returns table (workspace_id uuid, workspace_name text, workspace_slug text, membership_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_workspace_id uuid;
  matched_workspace_name text;
  matched_workspace_slug text;
  matched_invite_id uuid;
  matched_invite_role text;
begin
  -- Lock the matched invite row so two users cannot redeem the same single-use
  -- invite concurrently. Under READ COMMITTED, a second waiter re-evaluates the
  -- predicate after the lock is released and sees used_at populated, so it falls
  -- through to the "invalid or expired" error below.
  select w.id, w.name, w.slug, i.id, i.role
  into matched_workspace_id, matched_workspace_name, matched_workspace_slug, matched_invite_id, matched_invite_role
  from workspaces w
  join workspace_invites i on i.workspace_id = w.id
  where w.slug = target_workspace_slug
    and i.code = upper(trim(target_invite_code))
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and (i.is_reusable or i.used_at is null)
  limit 1
  for update of i;

  if not found then
    raise exception 'Workspace invite is invalid or expired.';
  end if;

  -- Serialize concurrent joins to this workspace so the member-cap check below
  -- can't be raced by two people redeeming different invites at the same time.
  perform 1 from workspaces where id = matched_workspace_id for update;

  if exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = matched_workspace_id
      and wm.user_id = target_user_id
  ) then
    raise exception 'You are already a member of this workspace.';
  end if;

  -- Cap workspace size (owner included). Keep in sync with MAX_WORKSPACE_MEMBERS
  -- in lib/workspaces.ts; enforced here so it holds even if the app check is
  -- bypassed or races.
  if (
    select count(*)
    from workspace_members wm
    where wm.workspace_id = matched_workspace_id
  ) >= 20 then
    raise exception 'Workspace member limit reached.';
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (matched_workspace_id, target_user_id, matched_invite_role);

  update workspace_invites
  set used_at = now()
  where id = matched_invite_id;

  return query
    select matched_workspace_id, matched_workspace_name, matched_workspace_slug, matched_invite_role;
exception
  when unique_violation then
    raise exception 'You are already a member of this workspace.';
end;
$$;

create or replace function delete_workspace_as_owner(target_workspace_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
      and wm.role = 'owner'
  ) then
    raise exception 'Workspace owner access is required.';
  end if;

  delete from workspaces w
  where w.id = target_workspace_id;

  if not found then
    raise exception 'Workspace not found.';
  end if;
end;
$$;

revoke all on function create_workspace_with_owner(text, text, uuid) from public;
revoke all on function join_workspace_by_invite(text, text, uuid) from public;
revoke all on function delete_workspace_as_owner(uuid, uuid) from public;
revoke all on function is_workspace_member(uuid) from public;
revoke all on function has_workspace_role(uuid, text[]) from public;
revoke all on function can_create_workspace_invite(uuid, text) from public;
revoke all on function can_remove_workspace_member(uuid, uuid) from public;
grant execute on function is_workspace_member(uuid) to authenticated, service_role;
grant execute on function has_workspace_role(uuid, text[]) to authenticated, service_role;
grant execute on function can_create_workspace_invite(uuid, text) to authenticated, service_role;
grant execute on function can_remove_workspace_member(uuid, uuid) to authenticated, service_role;
grant execute on function create_workspace_with_owner(text, text, uuid) to service_role;
grant execute on function join_workspace_by_invite(text, text, uuid) to service_role;
grant execute on function delete_workspace_as_owner(uuid, uuid) to service_role;

create or replace function can_view_workspace_request(target_workspace_id uuid, target_request_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from requests r
    where r.workspace_id = target_workspace_id
      and r.id = target_request_id
      and is_workspace_member(target_workspace_id)
      and (
        r.requester_user_id = auth.uid()
        or has_workspace_role(target_workspace_id, array['admin', 'owner'])
      )
  );
$$;

create or replace function can_view_workspace_ticket(target_workspace_id uuid, target_ticket_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tickets t
    where t.workspace_id = target_workspace_id
      and t.id = target_ticket_id
      and is_workspace_member(target_workspace_id)
      and (
        t.requester_user_id = auth.uid()
        or has_workspace_role(target_workspace_id, array['admin', 'owner'])
      )
  );
$$;

revoke all on function can_view_workspace_request(uuid, text) from public;
revoke all on function can_view_workspace_ticket(uuid, text) from public;
grant execute on function can_view_workspace_request(uuid, text) to authenticated, service_role;
grant execute on function can_view_workspace_ticket(uuid, text) to authenticated, service_role;

create or replace function check_rate_limit(
  target_scope text,
  target_key_hash text,
  target_limit integer,
  target_window_seconds integer,
  target_increment bigint default 1
)
returns table (allowed boolean, remaining bigint, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record security_rate_limits%rowtype;
begin
  if nullif(trim(target_scope), '') is null or nullif(trim(target_key_hash), '') is null then
    raise exception 'Rate limit scope and key are required.';
  end if;

  if target_limit < 1 or target_window_seconds < 1 or target_increment < 1 then
    raise exception 'Rate limit configuration is invalid.';
  end if;

  delete from security_rate_limits
  where updated_at < now() - interval '7 days';

  loop
    select *
    into current_record
    from security_rate_limits
    where scope = target_scope
      and key_hash = target_key_hash
    for update;

    if not found then
      begin
        insert into security_rate_limits (scope, key_hash, window_start, usage_count, updated_at)
        values (target_scope, target_key_hash, now(), target_increment, now())
        returning * into current_record;
        exit;
      exception
        when unique_violation then
          -- Another request created the row first; retry and lock it.
      end;
    elsif current_record.window_start + make_interval(secs => target_window_seconds) <= now() then
      update security_rate_limits
      set window_start = now(),
          usage_count = target_increment,
          updated_at = now()
      where scope = target_scope
        and key_hash = target_key_hash
      returning * into current_record;
      exit;
    else
      update security_rate_limits
      set usage_count = usage_count + target_increment,
          updated_at = now()
      where scope = target_scope
        and key_hash = target_key_hash
      returning * into current_record;
      exit;
    end if;
  end loop;

  reset_at := current_record.window_start + make_interval(secs => target_window_seconds);
  allowed := current_record.usage_count <= target_limit;
  remaining := greatest(target_limit::bigint - current_record.usage_count, 0);
  return next;
end;
$$;

revoke all on function check_rate_limit(text, text, integer, integer, bigint) from public;
grant execute on function check_rate_limit(text, text, integer, integer, bigint) to service_role;

alter table departments enable row level security;
alter table user_profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table requests enable row level security;
alter table ai_triage_results enable row level security;
alter table tickets enable row level security;
alter table ticket_activity enable row level security;
alter table ticket_notes enable row level security;
alter table request_attachments enable row level security;
alter table workspace_metadata enable row level security;
alter table notifications enable row level security;

drop policy if exists departments_select_all on departments;
drop policy if exists departments_select_member on departments;
create policy departments_select_member on departments for select using (is_workspace_member(workspace_id));
drop policy if exists departments_insert_admin on departments;
create policy departments_insert_admin on departments for insert with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists departments_update_admin on departments;
create policy departments_update_admin on departments for update using (has_workspace_role(workspace_id, array['admin', 'owner'])) with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists departments_delete_admin on departments;
create policy departments_delete_admin on departments for delete using (has_workspace_role(workspace_id, array['admin', 'owner']));

drop policy if exists user_profiles_select_self on user_profiles;
create policy user_profiles_select_self on user_profiles for select using (id = auth.uid());

drop policy if exists workspaces_select_member on workspaces;
create policy workspaces_select_member on workspaces for select using (is_workspace_member(id));
drop policy if exists workspaces_insert_creator on workspaces;
create policy workspaces_insert_creator on workspaces for insert with check (created_by = auth.uid());
drop policy if exists workspaces_update_owner on workspaces;
create policy workspaces_update_owner on workspaces for update using (has_workspace_role(id, array['owner'])) with check (has_workspace_role(id, array['owner']));
drop policy if exists workspaces_delete_owner on workspaces;
create policy workspaces_delete_owner on workspaces for delete using (has_workspace_role(id, array['owner']));

drop policy if exists workspace_members_select_member on workspace_members;
create policy workspace_members_select_member on workspace_members for select using (is_workspace_member(workspace_id));
drop policy if exists workspace_members_insert_owner on workspace_members;
create policy workspace_members_insert_owner on workspace_members for insert with check (has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_members_update_owner on workspace_members;
create policy workspace_members_update_owner on workspace_members for update using (has_workspace_role(workspace_id, array['owner'])) with check (has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_members_delete_owner on workspace_members;
drop policy if exists workspace_members_delete_allowed on workspace_members;
create policy workspace_members_delete_allowed on workspace_members for delete using (
  (user_id = auth.uid() and role <> 'owner')
  or can_remove_workspace_member(workspace_id, user_id)
);

drop policy if exists workspace_invites_select_owner on workspace_invites;
drop policy if exists workspace_invites_select_admin on workspace_invites;
create policy workspace_invites_select_admin on workspace_invites for select using (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists workspace_invites_insert_owner on workspace_invites;
drop policy if exists workspace_invites_insert_admin on workspace_invites;
create policy workspace_invites_insert_admin on workspace_invites for insert with check (created_by = auth.uid() and can_create_workspace_invite(workspace_id, role));
drop policy if exists workspace_invites_update_owner on workspace_invites;
create policy workspace_invites_update_owner on workspace_invites for update using (has_workspace_role(workspace_id, array['owner'])) with check (has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_invites_delete_owner on workspace_invites;
create policy workspace_invites_delete_owner on workspace_invites for delete using (has_workspace_role(workspace_id, array['owner']));

drop policy if exists requests_select_workspace_role on requests;
create policy requests_select_workspace_role on requests for select using (
  is_workspace_member(workspace_id)
  and (requester_user_id = auth.uid() or has_workspace_role(workspace_id, array['admin', 'owner']))
);
drop policy if exists requests_insert_requester on requests;
create policy requests_insert_requester on requests for insert with check (
  is_workspace_member(workspace_id)
  and requester_user_id = auth.uid()
);
drop policy if exists requests_update_admin on requests;
create policy requests_update_admin on requests for update using (has_workspace_role(workspace_id, array['admin', 'owner'])) with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists requests_delete_owner on requests;
create policy requests_delete_owner on requests for delete using (has_workspace_role(workspace_id, array['owner']));

drop policy if exists ai_triage_results_select_visible_request on ai_triage_results;
create policy ai_triage_results_select_visible_request on ai_triage_results for select using (can_view_workspace_request(workspace_id, request_id));
drop policy if exists ai_triage_results_insert_admin on ai_triage_results;
create policy ai_triage_results_insert_admin on ai_triage_results for insert with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists ai_triage_results_update_admin on ai_triage_results;
create policy ai_triage_results_update_admin on ai_triage_results for update using (has_workspace_role(workspace_id, array['admin', 'owner'])) with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists ai_triage_results_delete_owner on ai_triage_results;
create policy ai_triage_results_delete_owner on ai_triage_results for delete using (has_workspace_role(workspace_id, array['owner']));

drop policy if exists tickets_select_workspace_role on tickets;
create policy tickets_select_workspace_role on tickets for select using (
  is_workspace_member(workspace_id)
  and (requester_user_id = auth.uid() or has_workspace_role(workspace_id, array['admin', 'owner']))
);
drop policy if exists tickets_insert_admin on tickets;
create policy tickets_insert_admin on tickets for insert with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists tickets_update_admin on tickets;
create policy tickets_update_admin on tickets for update using (has_workspace_role(workspace_id, array['admin', 'owner'])) with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists tickets_delete_owner on tickets;
create policy tickets_delete_owner on tickets for delete using (has_workspace_role(workspace_id, array['owner']));

drop policy if exists ticket_activity_select_visible_record on ticket_activity;
create policy ticket_activity_select_visible_record on ticket_activity for select using (
  has_workspace_role(workspace_id, array['admin', 'owner'])
  or (ticket_id is not null and can_view_workspace_ticket(workspace_id, ticket_id))
  or (request_id is not null and can_view_workspace_request(workspace_id, request_id))
);
drop policy if exists ticket_activity_insert_admin on ticket_activity;
create policy ticket_activity_insert_admin on ticket_activity for insert with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists ticket_activity_delete_owner on ticket_activity;
create policy ticket_activity_delete_owner on ticket_activity for delete using (has_workspace_role(workspace_id, array['owner']));

drop policy if exists ticket_notes_select_admin on ticket_notes;
create policy ticket_notes_select_admin on ticket_notes for select using (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists ticket_notes_insert_admin on ticket_notes;
create policy ticket_notes_insert_admin on ticket_notes for insert with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists ticket_notes_update_admin on ticket_notes;
create policy ticket_notes_update_admin on ticket_notes for update using (has_workspace_role(workspace_id, array['admin', 'owner'])) with check (has_workspace_role(workspace_id, array['admin', 'owner']));
drop policy if exists ticket_notes_delete_owner on ticket_notes;
create policy ticket_notes_delete_owner on ticket_notes for delete using (has_workspace_role(workspace_id, array['owner']));

drop policy if exists request_attachments_select_visible_request on request_attachments;
create policy request_attachments_select_visible_request on request_attachments for select using (can_view_workspace_request(workspace_id, request_id));
drop policy if exists request_attachments_insert_visible_request on request_attachments;
create policy request_attachments_insert_visible_request on request_attachments for insert with check (can_view_workspace_request(workspace_id, request_id));
drop policy if exists request_attachments_delete_visible_request on request_attachments;
create policy request_attachments_delete_visible_request on request_attachments for delete using (can_view_workspace_request(workspace_id, request_id));

drop policy if exists workspace_metadata_select_member on workspace_metadata;
create policy workspace_metadata_select_member on workspace_metadata for select using (is_workspace_member(workspace_id));
drop policy if exists workspace_metadata_insert_owner on workspace_metadata;
create policy workspace_metadata_insert_owner on workspace_metadata for insert with check (has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_metadata_update_owner on workspace_metadata;
create policy workspace_metadata_update_owner on workspace_metadata for update using (has_workspace_role(workspace_id, array['owner'])) with check (has_workspace_role(workspace_id, array['owner']));
drop policy if exists workspace_metadata_delete_owner on workspace_metadata;
create policy workspace_metadata_delete_owner on workspace_metadata for delete using (has_workspace_role(workspace_id, array['owner']));

-- Notifications are private to their recipient. Rows are created only by the
-- service-role client (no authenticated insert policy); recipients may read them,
-- mark them read (update), and dismiss them (delete).
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications for select using (
  user_id = auth.uid() and is_workspace_member(workspace_id)
);
drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete_own on notifications;
create policy notifications_delete_own on notifications for delete using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments',
  'request-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json'
    ]
where id = 'request-images';
