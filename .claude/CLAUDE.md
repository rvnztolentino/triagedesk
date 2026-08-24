# TriageDesk

Configuration for working on this repository.

## What lives here

- `launch.json` - dev server launch config.
- `settings.local.json` - local MCP and permission settings. Not committed.

## Stack

Next.js 16 App Router, React 19, TypeScript 6, Tailwind 4. Clerk for auth, Supabase (Postgres + private storage) for persistence, Groq for AI triage, Sentry for monitoring. Package manager is pnpm.

## Commands

```
pnpm dev         # next dev
pnpm build       # next build
pnpm lint        # eslint .
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before considering work complete.

## Layout

- `app/` - routes, layouts, and `actions.ts` (all server actions).
- `lib/` - domain logic. `auth.ts` and `workspaces.ts` are the effective access boundary, `store.ts` is the only Supabase write path, `triage.ts` builds triage drafts, `demo.ts` mints and meters live-demo sessions, `security.ts` holds rate limiting and origin checks.
- `components/` - React components. Server Components by default.
- `supabase/schema.sql` - schema, functions, and grants.
- `proxy.ts` - edge middleware running `clerkMiddleware()`.

Tests sit next to the code as `*.test.ts` in `lib/`.

## Conventions

- Never use em-dashes in code, comments, docs, UI copy, or commit messages. Rewrite the sentence instead of substituting a hyphen.
- Validate every server action input with Zod, and apply the same-origin and rate-limit checks in `lib/security.ts`.
- Authorization is enforced in application code. Supabase RLS policies are defined but dormant, because no end-user Supabase session is issued. Do not assume RLS will catch a missing check.
- Never write to Supabase outside `lib/store.ts`.
- Triage must never assign Low priority to a request containing hazard language.
- Triage must degrade to the deterministic fallback rather than error, including on vague or malformed input.
