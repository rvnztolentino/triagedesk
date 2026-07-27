# TriageDesk

TriageDesk is an AI operations triage system for schools, clinics, offices, and facilities teams. It converts messy internal requests into structured AI triage suggestions, keeps admins in the review loop, and turns approved requests into tracked tickets inside workspace-scoped queues.

The app includes Supabase authentication, workspace creation and invites, requester/admin/owner roles, requester-scoped data visibility, request attachments, AI triage review, ticket history, activity history, and a read-only demo clinic workspace.

![Dashboard](public/docs/dashboard.png)

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Database, Storage, and Row Level Security
- Groq chat completions for AI triage
- Zod for validation
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

3. Create or open a Supabase project.

4. Enable Supabase Email Auth with email confirmation turned on.

5. Add these Supabase redirect URLs for local development:

```txt
http://localhost:3000
http://localhost:3000/auth/callback
```

6. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.

7. Confirm the `request-attachments` Supabase Storage bucket exists. The schema attempts to create it automatically.

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
GROQ_MODEL=openai/gpt-oss-20b

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SEED_ADMIN_EMAIL=admin@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_REQUEST_ATTACHMENTS_BUCKET=request-attachments
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not expose it in client code or commit real keys.

`SEED_ADMIN_EMAIL` bootstraps the protected owner account at the user-profile level. Sign up with that exact email and verify it through Supabase email confirmation. New workspaces are owned by the user who creates them.

`SUPABASE_REQUEST_ATTACHMENTS_BUCKET` stores request attachments privately. The code also accepts the older `SUPABASE_REQUEST_IMAGES_BUCKET` name as a fallback.

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

## GitHub Actions CI

This repository includes `.github/workflows/ci.yml`.

The workflow runs on pull requests and pushes to `main`:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The CI build uses placeholder Supabase and Groq environment values because these checks only need to compile and test the app. Do not put real service keys directly in the workflow file.

Manual setup:

1. Push this repository to GitHub.
2. Confirm the default branch is named `main`, or update `.github/workflows/ci.yml` if your default branch has a different name.
3. Open the repository in GitHub and go to `Actions`.
4. If GitHub prompts you to enable workflows, click `I understand my workflows, go ahead and enable them`.
5. Open a pull request or push to `main`.
6. Confirm the `CI / Lint, typecheck, test, and build` check passes.

Optional production secrets:

If you later add deployment or integration tests that need real services, add values in GitHub under `Settings` -> `Secrets and variables` -> `Actions`. Keep `SUPABASE_SERVICE_ROLE_KEY` as a secret, never a plain repository variable.

## Useful Routes

- `/` - marketing page for signed-out users, dashboard for an active workspace
- `/login` - sign in
- `/signup` - create an account
- `/onboarding` - create, join, or open workspaces
- `/join/[workspaceSlug]` - join a workspace with an invite code
- `/w/[workspaceSlug]` - workspace dashboard
- `/w/[workspaceSlug]/requests/new` - submit an operations request
- `/w/[workspaceSlug]/review` - admin triage review queue
- `/w/[workspaceSlug]/tickets` - requester or admin ticket list
- `/w/[workspaceSlug]/users` - workspace member management
- `/w/[workspaceSlug]/settings` - departments, system status, and appearance settings
- `/api/health` - setup health check

Legacy unscoped routes such as `/tickets`, `/review`, `/users`, `/settings`, and `/submit` use the active workspace cookie when available.

## Notes

- Runtime request submission requires `AI_PROVIDER=groq` and `GROQ_API_KEY`.
- AI triage retries transient Groq failures and falls back to keyword rules only after that. A fallback is a degraded result, so it is always logged — via Sentry when a DSN is set, otherwise as a `[triagedesk] operational error` server warning.
- `GROQ_MAX_COMPLETION_TOKENS` (default `1500`) must cover the model's hidden reasoning tokens *plus* the JSON response. Too low and Groq rejects the truncated generation, which demotes every request to rules triage. `GROQ_REASONING_EFFORT` (default `low`) is dropped automatically for models that reject it.
- Supabase email confirmation must stay enabled; the app rejects immediate signup sessions.
- Request attachments support JPG, PNG, WebP, PDF, DOCX, TXT, CSV, and JSON files up to 10 MB each.
- The `request-attachments` bucket is private; attachment downloads are served through workspace access checks.
- The `demo-clinic` workspace is a read-only preview. Create a workspace to submit requests or mutate tickets.
