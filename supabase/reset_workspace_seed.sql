begin;

insert into workspaces (id, name, slug, created_by)
values ('00000000-0000-4000-8000-000000000001', 'Demo Clinic', 'demo-clinic', null)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug;

-- The template is not joinable, so make sure no invite or membership points at it.
delete from workspace_invites
where workspace_id = '00000000-0000-4000-8000-000000000001'
  or code in ('DEMO-CLINIC-2026', 'DEMO-SCHOOL-2026');
delete from notifications where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from workspace_members where workspace_id = '00000000-0000-4000-8000-000000000001';

alter table requests alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table ai_triage_results alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table tickets alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table ticket_activity alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table ticket_notes alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table workspace_metadata alter column workspace_id set default '00000000-0000-4000-8000-000000000001';

delete from ticket_notes where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from ticket_activity where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from ai_triage_results where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from tickets where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from request_attachments where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from requests where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from workspace_metadata where workspace_id = '00000000-0000-4000-8000-000000000001';
delete from departments where workspace_id = '00000000-0000-4000-8000-000000000001';

insert into departments (workspace_id, id, name, description) values
  ('00000000-0000-4000-8000-000000000001', 'it', 'IT', 'Network, devices, software, projectors, printers, accounts.'),
  ('00000000-0000-4000-8000-000000000001', 'facilities', 'Facilities', 'General building operations and space coordination.'),
  ('00000000-0000-4000-8000-000000000001', 'maintenance', 'Maintenance', 'HVAC, leaks, electrical, plumbing, repairs.'),
  ('00000000-0000-4000-8000-000000000001', 'security', 'Security', 'Access control, doors, gates, badges, incidents.'),
  ('00000000-0000-4000-8000-000000000001', 'admin', 'Admin', 'Admin records, scheduling, office supplies, front desk operations.'),
  ('00000000-0000-4000-8000-000000000001', 'clinic', 'Clinic / Health', 'Patient areas, health concerns, medical rooms, clinical workflow support.')
on conflict (workspace_id, id) do update set
  name = excluded.name,
  description = excluded.description;

insert into requests (
  id,
  requester_user_id,
  description,
  location,
  contact_name,
  urgency_note,
  image_url,
  status,
  duplicate_of_ticket_id,
  created_at,
  reviewed_at
) values
  ('REQ-1001', null, 'There is a significant water leak coming from the ceiling near the back emergency exit. Water is pooling on the floor.', 'Outpatient Wing, Main Corridor', 'Sarah Jenkins', 'Morning patient intake starts in 2 hours.', null, 'needs-review', null, '2026-05-24T05:10:00.000Z', null),
  ('REQ-1002', null, 'The pediatric wing waiting area is very warm. Thermostat says 78 degrees and patients are complaining.', 'Clinic Wing C', 'Dr. Emily Ross', 'Patients are complaining.', null, 'needs-review', null, '2026-05-24T05:20:00.000Z', null),
  ('REQ-1003', null, 'Aircon in Recovery Room 304 is leaking again. Floor is wet near the outlet.', 'Recovery Wing, Room 304', 'Nurse Station', 'Wet floor near patients and staff.', null, 'needs-review', 'TRG-1038', '2026-05-24T05:30:00.000Z', null),
  ('REQ-1004', null, 'Someone reported smoke smell near the server closet and the network rack fans are loud.', 'Admin Block, Server Closet', 'Front Desk', 'Possible electrical issue.', null, 'needs-review', null, '2026-05-24T05:42:00.000Z', null),
  ('REQ-1005', null, 'The copy room is out of clinic intake forms and letter paper.', 'Building 2, Copy Room 2A', 'Admin Assistant', '', null, 'rejected', null, '2026-05-24T03:40:00.000Z', '2026-05-24T04:00:00.000Z');

insert into ai_triage_results (
  id,
  request_id,
  source,
  title,
  category,
  priority,
  department,
  summary,
  priority_reasoning,
  similar_ticket_ids,
  raw_response,
  created_at
) values
  ('TRI-1001', 'REQ-1001', 'groq', 'Water leak at Outpatient Wing, Main Corridor', 'Maintenance', 'critical', 'maintenance', 'Maintenance should dispatch immediately to the outpatient corridor. Water is pooling near an emergency exit before morning patient intake.', 'Pooling water creates slip risk, potential property damage, and direct disruption to patient intake.', array['TRG-1038'], null, '2026-05-24T05:11:00.000Z'),
  ('TRI-1002', 'REQ-1002', 'groq', 'HVAC issue at Clinic Wing C', 'Maintenance', 'high', 'maintenance', 'Maintenance should inspect Clinic Wing C. The waiting area is too warm for patient comfort.', 'Patient-facing spaces need faster response because comfort and care operations are affected.', array['TRG-1048'], null, '2026-05-24T05:21:00.000Z'),
  ('TRI-1003', 'REQ-1003', 'groq', 'HVAC issue at Recovery Wing, Room 304', 'Maintenance', 'high', 'maintenance', 'Maintenance should inspect Recovery Room 304 because the AC leak is recurring and creating a wet floor hazard.', 'Recurring leak and wet flooring create a safety risk for patients and staff.', array['TRG-1038'], null, '2026-05-24T05:31:00.000Z'),
  ('TRI-1004', 'REQ-1004', 'groq', 'Possible electrical issue at Admin Block, Server Closet', 'IT', 'critical', 'it', 'IT should inspect the server closet immediately and coordinate with Maintenance if electrical risk is confirmed.', 'Smoke smell near network equipment can indicate electrical risk and possible service outage.', array['TRG-1047'], null, '2026-05-24T05:43:00.000Z');

insert into tickets (
  id,
  request_id,
  requester_user_id,
  title,
  description,
  location,
  contact_name,
  urgency_note,
  status,
  priority,
  department,
  category,
  triage_summary,
  priority_reasoning,
  resolution_notes,
  duplicate_of_ticket_id,
  created_at,
  updated_at,
  resolved_at,
  closed_at
) values
  ('TRG-1043', null, null, 'Telehealth display unavailable', 'The telehealth display in Consultation Room B is showing a hardware error and the image is very dim.', 'Outpatient Wing, Consultation Room B', 'Mark Chen', 'Remote consultation at 3 PM.', 'open', 'medium', 'it', 'IT', 'Routine telehealth display inspection. Assign to IT before the afternoon consultation.', 'Consultation room equipment is impaired but does not block core operations yet.', '', null, '2026-05-23T14:30:00.000Z', '2026-05-23T15:00:00.000Z', null, null),
  ('TRG-1044', null, null, 'Keycard access denied at East Gate', 'Several employees report their badges are flashing red at the East Gate turnstiles.', 'East Gate Entrance', 'Security Desk', 'Creating a backup at the entrance.', 'in-progress', 'high', 'security', 'Security', 'Multiple access failures at a primary entry point. Likely authentication sync issue.', 'The issue affects multiple users and creates a physical security bottleneck.', '', null, '2026-05-24T04:45:00.000Z', '2026-05-24T04:55:00.000Z', null, null),
  ('TRG-1047', null, null, 'Network outage in admin wing', 'The admin wing lost Wi-Fi and wired network access for front desk machines.', 'Admin Block', 'Office Manager', 'Check-in desk cannot print visitor badges.', 'in-progress', 'critical', 'it', 'IT', 'IT should restore admin network access and verify switch health.', 'Front desk operations and visitor access are blocked.', '', null, '2026-05-24T02:35:00.000Z', '2026-05-24T03:15:00.000Z', null, null),
  ('TRG-1048', null, null, 'Warm air in clinic waiting area', 'Clinic waiting area AC is blowing warm air during afternoon intake.', 'Clinic Wing C', 'Nurse Station', 'Patients waiting with children.', 'open', 'high', 'maintenance', 'Maintenance', 'HVAC issue in patient-facing area requires prompt maintenance inspection.', 'Patient comfort and clinical operations are affected.', '', null, '2026-05-23T22:15:00.000Z', '2026-05-23T22:25:00.000Z', null, null),
  ('TRG-1030', null, null, 'Restock copy paper', 'The copy room on the 2nd floor is completely out of letter-sized paper.', 'Building 2, Copy Room 2A', 'Admin Assistant', '', 'resolved', 'low', 'admin', 'Admin', 'Standard supply request.', 'Routine request with no immediate operational threat.', 'Restocked 10 reams of letter paper and added a reorder marker.', null, '2026-05-22T09:00:00.000Z', '2026-05-22T10:15:00.000Z', '2026-05-22T10:15:00.000Z', null),
  ('TRG-1038', null, null, 'AC drain leak near Recovery Room 304', 'AC drain line leaked near Recovery Room 304 and made the tile slippery.', 'Recovery Wing, Room 304', 'Facilities Desk', '', 'closed', 'high', 'maintenance', 'Maintenance', 'HVAC drain issue created a slip hazard.', 'Wet flooring can create safety risk.', 'Drain line cleared and floor dried. Monitor for recurrence.', null, '2026-05-20T02:00:00.000Z', '2026-05-20T06:00:00.000Z', '2026-05-20T05:30:00.000Z', '2026-05-20T06:00:00.000Z');

insert into ticket_activity (
  id,
  ticket_id,
  request_id,
  action,
  actor,
  details,
  created_at
) values
  ('ACT-1001', 'TRG-1047', null, 'Ticket approved', 'Admin', 'Approved as critical IT incident.', '2026-05-24T02:40:00.000Z'),
  ('ACT-1002', 'TRG-1047', null, 'Status changed', 'IT Lead', 'Moved to in progress; checking switch uplink.', '2026-05-24T03:15:00.000Z'),
  ('ACT-1003', 'TRG-1044', null, 'Ticket approved', 'System', 'Assigned to Security.', '2026-05-24T04:50:00.000Z'),
  ('ACT-1004', 'TRG-1044', null, 'Status changed', 'Security Desk', 'Badge sync check started.', '2026-05-24T04:55:00.000Z'),
  ('ACT-1005', null, 'REQ-1001', 'AI triage completed', 'System', 'Critical maintenance request with patient intake impact.', '2026-05-24T05:11:00.000Z'),
  ('ACT-1006', null, 'REQ-1002', 'AI triage completed', 'System', 'High-priority clinic HVAC request.', '2026-05-24T05:21:00.000Z'),
  ('ACT-1007', null, 'REQ-1003', 'AI triage completed', 'System', 'Similar Room 304 AC drain leak found.', '2026-05-24T05:31:00.000Z'),
  ('ACT-1008', null, 'REQ-1004', 'AI triage completed', 'System', 'Critical IT request with electrical risk language.', '2026-05-24T05:43:00.000Z'),
  ('ACT-1009', 'TRG-1030', null, 'Resolved', 'Admin', 'Supplies restocked.', '2026-05-22T10:15:00.000Z'),
  ('ACT-1010', 'TRG-1038', null, 'Closed', 'Maintenance', 'Drain line cleared and monitored.', '2026-05-20T06:00:00.000Z'),
  ('ACT-1011', 'TRG-1048', null, 'Assigned', 'Maintenance Lead', 'HVAC technician assigned for clinic waiting area inspection.', '2026-05-24T05:50:00.000Z'),
  ('ACT-1012', 'TRG-1043', null, 'Note added', 'IT Support', 'Replacement telehealth display cable pulled from storage.', '2026-05-24T06:05:00.000Z'),
  ('ACT-1013', 'TRG-1044', null, 'Vendor contacted', 'Security Desk', 'Access controller vendor asked to review East Gate sync logs.', '2026-05-24T06:18:00.000Z'),
  ('ACT-1014', 'TRG-1047', null, 'Escalated', 'IT Lead', 'Network outage escalated to infrastructure team.', '2026-05-24T06:32:00.000Z'),
  ('ACT-1015', null, 'REQ-1002', 'Review pending', 'Admin', 'Clinic HVAC request kept in review for technician availability.', '2026-05-24T06:45:00.000Z'),
  ('ACT-1016', 'TRG-1048', null, 'Status changed', 'Maintenance Lead', 'Clinic waiting area ticket moved to in progress.', '2026-05-24T07:00:00.000Z'),
  ('ACT-1017', 'TRG-1043', null, 'Scheduled', 'IT Support', 'Telehealth display inspection scheduled before remote consultation.', '2026-05-24T07:15:00.000Z'),
  ('ACT-1018', null, 'REQ-1004', 'Safety check requested', 'Admin', 'Maintenance asked to inspect outlet and smoke smell near server closet.', '2026-05-24T07:28:00.000Z'),
  ('ACT-1019', 'TRG-1044', null, 'Controller restarted', 'Security Desk', 'East Gate controller restart completed; monitoring badge scans.', '2026-05-24T07:42:00.000Z'),
  ('ACT-1020', 'TRG-1047', null, 'Service restored', 'IT Lead', 'Admin wing wired network restored after uplink replacement.', '2026-05-24T07:55:00.000Z');

insert into ticket_notes (
  id,
  ticket_id,
  actor,
  body,
  created_at
) values
  ('NOTE-1001', 'TRG-1047', 'IT Lead', 'Switch uplink is flapping; replacing patch cable before escalating to ISP.', '2026-05-24T03:20:00.000Z'),
  ('NOTE-1002', 'TRG-1044', 'Security Desk', 'Badge failures are isolated to the east gate controller.', '2026-05-24T05:05:00.000Z');

insert into workspace_metadata (key, value) values
  ('seeded', 'triagedesk-demo-clinic-seed-v4'),
  ('seeded_at', now()::text)
on conflict (workspace_id, key) do update set
  value = excluded.value;

alter table requests alter column workspace_id drop default;
alter table ai_triage_results alter column workspace_id drop default;
alter table tickets alter column workspace_id drop default;
alter table ticket_activity alter column workspace_id drop default;
alter table ticket_notes alter column workspace_id drop default;
alter table workspace_metadata alter column workspace_id drop default;

-- The seed rows above insert explicit ids (REQ-1001, TRG-1043, …), which bypass the
-- entity id sequences and leave them behind. Re-point each sequence at the highest
-- id now present (across every real workspace, not just the demo) or the next insert
-- after a reset collides on the primary key.
--
-- Both terms stop below 900000, the floor of the live demo number space. This used to
-- take the highest id in the table outright, so running it while any live demo
-- workspace existed pushed these REAL sequences up into the demo range, and every
-- following insert into a real workspace was handed a 900000+ id a demo row already
-- held: "duplicate key value violates unique constraint requests_pkey" on submit.
-- Live demo rows keep their own sequences (entity_id_demo_*) and are not this script's
-- business. Excluding a contaminated last_value is what lets this script repair such a
-- sequence rather than preserve the damage through greatest().
--
-- Requires supabase/schema.sql to have been applied first; without the sequences
-- these statements error and the whole transaction rolls back.
--
-- greatest() includes the sequence's own last_value so an already-advanced sequence
-- is left alone rather than pulled backwards. On a database with live traffic this
-- read-then-setval is not atomic: a nextval landing between the two could be undone.
-- Resetting the demo seed is a deliberate, rare admin action, so run it when the app
-- is quiet rather than mid-traffic.
select setval('entity_id_requests_seq', greatest(
  999,
  coalesce((select max((regexp_replace(id, '^REQ-', ''))::bigint) from requests
            where id ~ '^REQ-[0-9]+$' and (regexp_replace(id, '^REQ-', ''))::bigint < 900000), 0),
  coalesce((select last_value from pg_sequences where schemaname = 'public'
            and sequencename = 'entity_id_requests_seq' and last_value < 900000), 0)
));
select setval('entity_id_tickets_seq', greatest(
  999,
  coalesce((select max((regexp_replace(id, '^TRG-', ''))::bigint) from tickets
            where id ~ '^TRG-[0-9]+$' and (regexp_replace(id, '^TRG-', ''))::bigint < 900000), 0),
  coalesce((select last_value from pg_sequences where schemaname = 'public'
            and sequencename = 'entity_id_tickets_seq' and last_value < 900000), 0)
));
select setval('entity_id_triage_seq', greatest(
  999,
  coalesce((select max((regexp_replace(id, '^TRI-', ''))::bigint) from ai_triage_results
            where id ~ '^TRI-[0-9]+$' and (regexp_replace(id, '^TRI-', ''))::bigint < 900000), 0),
  coalesce((select last_value from pg_sequences where schemaname = 'public'
            and sequencename = 'entity_id_triage_seq' and last_value < 900000), 0)
));
select setval('entity_id_activity_seq', greatest(
  999,
  coalesce((select max((regexp_replace(id, '^ACT-', ''))::bigint) from ticket_activity
            where id ~ '^ACT-[0-9]+$' and (regexp_replace(id, '^ACT-', ''))::bigint < 900000), 0),
  coalesce((select last_value from pg_sequences where schemaname = 'public'
            and sequencename = 'entity_id_activity_seq' and last_value < 900000), 0)
));
select setval('entity_id_notes_seq', greatest(
  999,
  coalesce((select max((regexp_replace(id, '^NOTE-', ''))::bigint) from ticket_notes
            where id ~ '^NOTE-[0-9]+$' and (regexp_replace(id, '^NOTE-', ''))::bigint < 900000), 0),
  coalesce((select last_value from pg_sequences where schemaname = 'public'
            and sequencename = 'entity_id_notes_seq' and last_value < 900000), 0)
));

commit;
