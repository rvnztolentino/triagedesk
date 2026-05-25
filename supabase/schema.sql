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

create table if not exists requests (
  id text primary key,
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
  ticket_id text references tickets(id) on delete cascade,
  request_id text references requests(id) on delete cascade,
  action text not null,
  actor text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists ticket_notes (
  id text primary key,
  ticket_id text not null references tickets(id) on delete cascade,
  actor text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_metadata (
  key text primary key,
  value text not null
);

alter table requests add column if not exists requester_user_id uuid references user_profiles(id) on delete set null;
alter table tickets add column if not exists requester_user_id uuid references user_profiles(id) on delete set null;

create index if not exists requests_status_created_at_idx on requests (status, created_at desc);
create index if not exists requests_requester_created_at_idx on requests (requester_user_id, created_at desc);
create index if not exists tickets_status_created_at_idx on tickets (status, created_at desc);
create index if not exists tickets_requester_created_at_idx on tickets (requester_user_id, created_at desc);
create index if not exists ticket_activity_ticket_created_at_idx on ticket_activity (ticket_id, created_at desc);
create index if not exists ticket_notes_ticket_created_at_idx on ticket_notes (ticket_id, created_at desc);
create index if not exists user_profiles_role_created_at_idx on user_profiles (role, created_at desc);

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
