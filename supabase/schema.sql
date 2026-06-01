create table if not exists departments (
  id text primary key,
  name text not null,
  description text not null default ''
);

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'requester' check (role in ('requester', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table user_profiles drop constraint if exists user_profiles_role_check;
  alter table user_profiles add constraint user_profiles_role_check check (role in ('requester', 'admin', 'owner'));
end $$;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into workspaces (id, name, slug, created_by)
values ('00000000-0000-4000-8000-000000000001', 'Demo School', 'demo-school', null)
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
  department text not null references departments(id),
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
  status text not null check (status in ('new', 'needs-review', 'open', 'in-progress', 'resolved', 'closed')),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  department text not null references departments(id),
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
  storage_path text not null,
  public_url text,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 5242880),
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
  'DEMO-SCHOOL-2026',
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

create index if not exists requests_status_created_at_idx on requests (status, created_at desc);
create unique index if not exists requests_workspace_id_id_idx on requests (workspace_id, id);
create index if not exists requests_workspace_status_created_at_idx on requests (workspace_id, status, created_at desc);
create index if not exists requests_requester_created_at_idx on requests (requester_user_id, created_at desc);
create index if not exists tickets_status_created_at_idx on tickets (status, created_at desc);
create unique index if not exists tickets_workspace_id_id_idx on tickets (workspace_id, id);
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
create index if not exists request_attachments_workspace_request_created_at_idx on request_attachments (workspace_id, request_id, created_at desc);

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

insert into departments (id, name, description) values
  ('it', 'IT', 'Network, devices, software, projectors, printers, accounts.'),
  ('maintenance', 'Maintenance', 'HVAC, leaks, electrical, plumbing, repairs.'),
  ('admin', 'Admin', 'Records, scheduling, office supplies, front desk operations.'),
  ('security', 'Security', 'Access control, doors, gates, badges, incidents.'),
  ('clinic', 'Clinic', 'Patient areas, medical rooms, clinical workflow support.'),
  ('facilities', 'Facilities', 'General building operations and space coordination.')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
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
    from workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
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

create or replace function can_view_workspace_request(target_workspace_id uuid, target_request_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from requests
    where workspace_id = target_workspace_id
      and id = target_request_id
      and is_workspace_member(target_workspace_id)
      and (
        requester_user_id = auth.uid()
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
    from tickets
    where workspace_id = target_workspace_id
      and id = target_ticket_id
      and is_workspace_member(target_workspace_id)
      and (
        requester_user_id = auth.uid()
        or has_workspace_role(target_workspace_id, array['admin', 'owner'])
      )
  );
$$;

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

drop policy if exists departments_select_all on departments;
create policy departments_select_all on departments for select using (true);

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
create policy workspace_members_delete_owner on workspace_members for delete using (has_workspace_role(workspace_id, array['owner']));

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-images',
  'request-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The request-images bucket is public for a product showcase. Do not use this
-- bucket policy for sensitive production requester images.
