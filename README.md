# TriageDesk

TriageDesk is an AI operations triage system for schools, clinics, offices, and facilities teams. It turns messy internal requests into structured Groq triage suggestions, keeps admins in the review loop, and converts approved requests into tracked tickets.

The product includes Supabase authentication, requester/admin roles, requester-scoped data visibility, admin review flows, request image uploads, ticket history, and activity history.

![Dashboard](public/docs/dashboard.png)

## Product Focus

...

## Features

...

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Database, and Storage
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

7. Confirm the `request-attachments` storage bucket exists. The schema attempts to create it automatically.

8. Create a Groq API key and add it to `.env.local`.

9. Start the app and verify setup:

```sh
pnpm dev
```

Open:

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

`SEED_ADMIN_EMAIL` bootstraps the protected owner account. Sign up with that exact email and verify it through Supabase email confirmation. Other verified signups become requesters by default.

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

## Useful Routes

- `/login` - sign in
- `/preview` - read-only sample workspace
- `/signup` - create an account
- `/submit` - submit an operations request
- `/review` - admin triage review queue
- `/tickets` - view requester or admin ticket lists
- `/users` - workspace user management
- `/settings` - system status and appearance settings
- `/api/health` - setup health check

## Notes

- Runtime request submission requires `AI_PROVIDER=groq` and `GROQ_API_KEY`.
- Supabase email confirmation must stay enabled; the app rejects immediate signup sessions.
- Request attachments support common image and document files up to 10 MB each.
- The `request-attachments` bucket is private; attachment links are served through workspace access checks.
