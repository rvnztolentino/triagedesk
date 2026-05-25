# TriageDesk

AI-powered internal operations triage for schools, clinics, offices, and facilities teams.

TriageDesk turns messy operational requests into structured work: a requester submits a plain-language issue, AI suggests category/priority/department/summary, and an admin reviews the output before it becomes a trackable ticket. The product is built as a portfolio-ready full-stack prototype with Supabase Auth, requester/admin roles, Supabase persistence/storage, and Groq-powered server-side triage.

Use free/no-card accounts or local Supabase only. Do not enter payment information for this project.

## Why This Is Not Just A Ticket App

- Role-based workflow: requesters submit and track their own work; admins manage triage, tickets, users, and settings.
- Human-in-the-loop AI triage: AI drafts structured ticket data, but admins approve, edit, reject, or mark duplicates.
- Operational prioritization: requests are classified by priority, department, SLA risk, aging work, and workload impact.
- Requester-scoped tracking: non-admin users only see tickets connected to their own submitted requests.
- Activity visibility: ticket updates, request saves, triage events, notes, and status changes are captured in activity/history views.

## Complete Workflow

1. A requester signs in and submits a messy request such as: `Aircon in Room 304 is leaking again. Floor is wet near the outlet.`
2. Server-side AI triage generates a structured title, category, priority, department, summary, reasoning, and similar-ticket suggestions.
3. An admin reviews the AI output in the triage inbox.
4. The admin approves, edits, rejects, or marks the request as a duplicate.
5. Approved requests become tickets.
6. Admins update ticket status, department, internal notes, and resolution notes.
7. Requesters view progress for their own approved tickets.
8. Dashboard metrics and activity history update from workspace data.

## Technical Highlights

- Supabase Auth email/password login and signup.
- Email verification is required before an account can sign in or receive an app role.
- Supabase `user_profiles` roles with requester default signup behavior.
- `SEED_ADMIN_EMAIL` bootstrap for the first admin account; signup has no admin role selector.
- Requester-scoped ticket visibility using requester ownership on requests and tickets.
- Admin-only dashboard, review queue, ticket mutation actions, user management, settings, and workspace reset.
- Server-only Groq handling through Next.js server actions; API keys stay out of client components.
- AI safeguards: validate setup/input before calls, reuse exact-match prior triage where possible, and send clipped/minimal prompt context.
- Deterministic rules triage helper for tests and sample logic; runtime request submission requires Groq configuration.
- Similar-ticket suggestions and lightweight duplicate detection based on existing ticket metadata and matching terms. No embeddings/vector search are used.
- Activity history/audit trail for request saves, AI triage completion, approvals, status changes, notes, duplicate marking, and resolution.
- Supabase Storage support for optional request images through the `request-images` bucket.

## Implemented Features

- Dark, operations-focused UI based on `.codex/design/`.
- Request submission with description, location, optional contact, optional urgency note, and optional image upload.
- Admin review queue with editable AI suggestions.
- Ticket list/detail with filters, status changes, department reassignment, notes, resolution notes, activity history, and similar-ticket suggestions.
- Dashboard with backlog, high priority, SLA risk, aging tickets, assigned work, resolved work, priority distribution, department workload, resolution trend, and recent activity.
- User management for admin promotion/demotion.
- Settings page for configuration and access policy review.
- Health endpoint for setup status.

## Quick Seed/Sample Walkthrough

1. Complete `.codex/setup.md`.
2. Start the app:

```sh
pnpm dev
```

3. Open `/api/health` and confirm `ok: true`.
4. Open `/signup`, create the first admin with the exact `SEED_ADMIN_EMAIL`, then verify that email from the Supabase email link.
5. From the admin dashboard, click **Reset Workspace** to load sample operational data.
6. Sign out, then create and verify a requester account with a different email.
7. Submit this sample request from `/submit`:

```txt
Aircon in Room 304 is leaking again. Floor is wet near the outlet.
```

8. Sign back in as admin, open `/review`, inspect the AI triage output, and approve the request.
9. Update the created ticket through `open`, `in-progress`, and `resolved`.
10. Sign in as the requester and confirm only their own ticket progress is visible.

## Walkthrough / Screenshots

Add screenshots or a short GIF for this flow before publishing the portfolio page:

- Requester signup and request submission.
- AI triage confirmation with suggested title, priority, department, summary, and reasoning.
- Admin review screen showing approve/edit/reject/duplicate actions.
- Ticket detail page with status updates, notes, similar-ticket suggestions, and activity history.
- Requester ticket view showing scoped progress.
- Admin dashboard showing operational metrics and recent activity.
- User management screen showing requester/admin role controls.

## Free-Only Checklist

- Required AI provider is configured with `AI_PROVIDER=groq`.
- Required database/auth provider is Supabase.
- Required optional-image storage is the `request-images` bucket.
- Do not add OpenAI billing or any paid API key.
- Do not enable paid Supabase, Vercel, storage, database, or AI add-ons.
- If a provider asks for payment information or a card, stop setup under the free-only constraint.
- Package versions are exact pins. Do not use version ranges or `latest`.
- Next.js is pinned to `16.2.6`, newer than the `16.0.7` patched floor listed in the CVE-2025-66478 advisory.

## Architecture

- `app/` - Next.js App Router pages, route handlers, and server actions.
- `components/` - shared app shell/layout.
- `lib/schema.ts` - Zod schemas and domain types.
- `lib/auth.ts` - Supabase Auth session cookies, profile roles, signup/login/logout, and role checks.
- `lib/supabase.ts` - Supabase clients and runtime setup detection.
- `lib/store.ts` - Supabase CRUD, seed/reset, requester scoping, metrics, and mutations.
- `lib/triage.ts` - Groq runtime triage plus deterministic rules helper for tests/sample logic.
- `supabase/schema.sql` - Supabase tables, indexes, departments, profile roles, requester ownership columns, and storage bucket setup.

## Setup

```sh
pnpm install
cp .env.example .env.local
```

Then follow `.codex/setup.md` to configure Supabase Auth, Supabase Database/Storage, Groq, `SEED_ADMIN_EMAIL`, and the schema.

Required environment variables:

```env
AI_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEED_ADMIN_EMAIL=admin@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_REQUEST_IMAGES_BUCKET=request-images
```

Useful routes:

- `/login` sign in
- `/signup` requester signup and seed-admin bootstrap
- `/auth/callback` email verification callback
- `/submit` requester submission
- `/tickets` requester/admin ticket list
- `/` admin dashboard
- `/review` admin review queue
- `/users` admin user management
- `/settings` admin settings
- `/api/health` setup health check

## Verification

```sh
pnpm audit --audit-level moderate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Resume One-Liner

Built an authenticated AI operations triage system that converts messy facility, clinic, admin, security, and IT requests into requester-scoped tickets with admin-reviewed AI triage, role management, activity history, duplicate suggestions, analytics, and resolution tracking.
