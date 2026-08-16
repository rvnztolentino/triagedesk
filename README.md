# TriageDesk

TriageDesk is an AI operations triage system for schools, clinics, offices, and facilities teams. It turns messy internal requests into structured triage drafts, keeps an admin in the review loop, and converts approved requests into tracked tickets inside workspace-scoped queues.

The app includes Clerk authentication, workspace creation and invites, requester/admin/owner roles, requester-scoped data visibility, private request attachments, AI triage review with a deterministic safety floor, ticket and activity history, in-app notifications, self-service account management, and a read-only demo clinic workspace.

![Dashboard](public/docs/dashboard.png)

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript 6
- Tailwind CSS 4
- Clerk for authentication and sessions
- Supabase PostgreSQL and Storage (database and storage only; not auth)
- Groq chat completions for AI triage
- Zod for validation
- Sentry for optional error monitoring
- Vitest, ESLint, and TypeScript checks

## Setup

1. Install dependencies:

```sh
pnpm install
```

2. Create a local environment file:

```sh
cp .env.example .env.local
```

3. Create a Clerk application. Copy the publishable and secret keys from `Dashboard` -> `API keys` into `.env.local`. Enable the email/password strategy with email-code verification, and enable Google as a social connection if you want Google sign-in.

4. Create or open a Supabase project. It is used for database and storage only, so Supabase Auth does not need configuring and the anon key is not required.

5. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor. It is idempotent and also migrates pre-Clerk databases.

6. Confirm the `request-attachments` Supabase Storage bucket exists. The schema attempts to create it automatically, and it must stay private.

7. Set `SEED_ADMIN_EMAIL` to the Clerk account email that should become the protected owner on first sign-in.

8. Create a Groq API key and add it to `.env.local`.

9. Start the app:

```sh
pnpm dev
```

10. Verify setup:

```txt
http://localhost:3000/api/health
```

The health response should return `ok: true`.

## Configuration

Required environment variables:

```env
AI_PROVIDER=groq
GROQ_API_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

SEED_ADMIN_EMAIL=admin@example.com
```

Optional environment variables:

```env
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MAX_COMPLETION_TOKENS=1500
GROQ_REASONING_EFFORT=low

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CONTACT_EMAIL=
SUPABASE_REQUEST_ATTACHMENTS_BUCKET=request-attachments
RATE_LIMIT_SALT=
HEALTHCHECK_TOKEN=

DEMO_SESSION_SECRET=
DEMO_ENABLED=

NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

`CLERK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only. Do not expose them in client code or commit real keys.

`SUPABASE_SERVICE_ROLE_KEY` is the only Supabase key the app uses. The anon key was removed with the Clerk migration.

`SEED_ADMIN_EMAIL` bootstraps the protected owner account at the user-profile level. Sign up with that exact email and verify it through Clerk's emailed code. New workspaces are owned by the user who creates them.

`NEXT_PUBLIC_SITE_URL` builds absolute post-auth redirect URLs, same-origin checks, and metadata routes. It falls back to `VERCEL_URL`, then `http://localhost:3000`.

`SUPABASE_REQUEST_ATTACHMENTS_BUCKET` names the private attachment bucket. The code also accepts the older `SUPABASE_REQUEST_IMAGES_BUCKET` name as a fallback.

`RATE_LIMIT_SALT` salts stored rate-limit identity hashes and is required in production. Generate one with `openssl rand -hex 32`. Rate-limit keys are hashed before storage so the table never holds raw IPs or emails, and the salt is what keeps those hashes irreversible against a low-entropy input space. Unset, the app falls back to the service-role key; in production it refuses the published development salt outright rather than storing guessable hashes. `HEALTHCHECK_TOKEN` unlocks detailed `/api/health` diagnostics in production.

`NEXT_PUBLIC_CONTACT_EMAIL` is the support address in the landing page contact panel. Left blank, the panel reports that no address is configured. It is inlined into the client bundle at build time, so treat anything you set as public.

`DEMO_SESSION_SECRET` signs the live demo session cookie and must stay server-only. Generate it with `openssl rand -hex 32`. Leaving it blank disables the demo, which is deliberate: unsigned demo cookies would be forgeable, so the feature fails closed. Rotating it ends every active demo session and nothing else. `DEMO_ENABLED=false` is a kill switch that turns the demo off without a deploy.

`SUPABASE_ACCESS_TOKEN` is needed only by the Supabase MCP server. Copy `.mcp.json.example` to `.mcp.json`, which is gitignored, and set your own project ref. It is a per-collaborator tooling token, not a runtime value.

## How to Run

Development:

```sh
pnpm dev
```

Production build:

```sh
pnpm build
pnpm start
```

Quality checks:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

## Routes

- `/` - marketing page for signed-out users, dashboard for an active workspace
- `/login`, `/signup` - Clerk-driven sign in and sign up
- `/signup/check-email` - email code verification with a 120-second resend cooldown
- `/auth/callback` - finalizes Google SSO
- `/onboarding` - create, join, or open workspaces
- `/join/[workspaceSlug]` - join a workspace with an invite code
- `/account` - display name changes and account deletion
- `/notifications` - notification history
- `/w/[workspaceSlug]` - workspace dashboard
- `/w/[workspaceSlug]/requests/new` - submit an operations request
- `/w/[workspaceSlug]/review` - admin triage review queue
- `/w/[workspaceSlug]/tickets` - requester or admin ticket list
- `/w/[workspaceSlug]/users` - workspace member management
- `/w/[workspaceSlug]/settings` - departments, system status, and appearance settings
- `/w/[workspaceSlug]/activate` - sets the active workspace cookie and redirects
- `/attachments/[id]`, `/w/[workspaceSlug]/attachments/[id]` - access-checked attachment delivery
- `/api/health` - setup health check
- `/robots.txt`, `/sitemap.xml` - crawler metadata; only `/`, `/login`, and `/signup` are indexable

Legacy unscoped routes such as `/tickets`, `/review`, `/requests`, `/users`, `/settings`, and `/submit` use the active workspace cookie when available.

## Continuous Integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The workflow uses placeholder Supabase and Groq values because these checks only compile and test the app. It sets no Clerk keys and still passes. Never put real service keys in the workflow file; add them under `Settings` -> `Secrets and variables` -> `Actions` if deployment or integration tests need them later.

## AI Triage Behavior

- Runtime request submission requires `AI_PROVIDER=groq` and `GROQ_API_KEY`. Keyword rules are an error fallback, not a selectable provider.
- Groq is called up to 3 times per request, 8 seconds per attempt, within a 20-second overall budget. Failure falls back to deterministic keyword rules.
- A fallback is a degraded result, so it is always logged, via Sentry when a DSN is set, otherwise as a `[triagedesk] operational error` server warning.
- `GROQ_MAX_COMPLETION_TOKENS` (default `1500`) must cover the model's hidden reasoning tokens *plus* the JSON response. Too low and Groq rejects the truncated generation, which demotes every request to rules triage. `GROQ_REASONING_EFFORT` (default `low`) is dropped automatically for models that reject it.
- A safety floor runs on both the model and rules paths: hazard language raises priority to `high` and replaces the priority reasoning with a fixed sentence. It is keyword-based, so unusual phrasing can be missed and a harmless match still escalates.
- The model sees only the request description, location, urgency note, up to three similar-ticket summaries, and the allowed department IDs. Attachments, contact names, and requester identity are never sent.
- The "Triage confidence" bar is a deterministic presentation value derived from the record ID, not a model-produced confidence.
- Approval is always human. A submitted request stays `needs-review` until an admin approves, rejects, or marks it a duplicate.

## Notes

- Authentication is Clerk: email/password with emailed verification codes, device verification on untrusted sign-ins, and Google SSO. Clerk owns the session cookie; the only app-owned cookie is `triagedesk_active_workspace`.
- Sign-in and sign-up error copy discloses whether an email is already registered. This is a deliberate usability trade, not an oversight.
- Supabase row-level security is enabled on every table, but the policies are dormant. They target `auth.uid()`, which no longer resolves under Clerk, and every query runs through the service-role client, which bypasses RLS entirely. Server-side guards in `lib/auth.ts` and `lib/workspaces.ts` are the sole authorization boundary, so a missed guard has no database backstop. The public REST surface is still closed: the anon key is unused, and RLS with non-resolving policies denies by default rather than allowing.
- Request attachments support JPG, PNG, WebP, PDF, DOCX, TXT, CSV, and JSON, up to 3 files per request and 10 MiB each. The bucket is private and downloads are served through workspace access checks.
- Resource caps: 3 workspaces per user, 20 members per workspace, 5 active invites per workspace, 10 custom departments per workspace, and 2 display-name changes per rolling 3-month window.
- Submissions, uploads, invite joins, and admin mutations are rate-limited with persistent, salted, database-backed counters.
- In-app notifications cover request, ticket, and membership events. The bell polls every 30 seconds and delivery failures never break the triggering mutation.
- The `demo-clinic` workspace is a read-only preview. Create a workspace to submit requests or mutate tickets.
- `supabase/reset_workspace_seed.sql` reseeds the demo workspace; `supabase/prune.sql` is an optional manual cleanup script for orphaned data.

## License

Copyright (c) 2026 Renz Tolentino. All rights reserved.

This is a private repository. Access does not grant permission to copy, redistribute, or reuse the source.
