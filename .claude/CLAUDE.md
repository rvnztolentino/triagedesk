# TriageDesk

Configuration for working on this repository.

## What lives here

- `CLAUDE.md` and `launch.json` are the only tracked files. `.gitignore` excludes the rest of `.claude/`.
- `launch.json` - dev server launch config.
- `settings.local.json` - local MCP and permission settings. Not committed.

## Stack

Next.js 16 App Router, React 19, TypeScript 6, Tailwind 4. Clerk for auth, Supabase (Postgres + private Storage) for persistence, Groq for AI triage, Sentry for optional monitoring. Package manager is pnpm.

Supabase is database and storage only. Clerk owns identity. There is no Supabase Auth session and no anon key.

Groq is called with plain `fetch` against its OpenAI-compatible chat completions endpoint (`lib/triage.ts`). There is no AI SDK dependency. Do not add one.

## Commands

```
pnpm dev         # next dev
pnpm build       # next build
pnpm lint        # eslint .
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before considering work complete. CI (`.github/workflows/ci.yml`) runs those three plus `pnpm build` against placeholder env values, so a change that only fails at build time still fails the PR.

## Layout

- `app/` - routes, layouts, and `actions.ts`. `actions.ts` is the only `"use server"` file in the repo; every server action lives there.
- `lib/` - domain logic, all server-side unless the filename says otherwise (`auth-client.ts`, `demo-ui.ts`).
- `components/` - React components. Server Components by default.
- `supabase/schema.sql` - schema, functions, grants, and idempotent migrations. `prune.sql` and `reset_workspace_seed.sql` are operator scripts.
- `proxy.ts` - Next 16 middleware file, running `clerkMiddleware()` only. It populates `auth()`; it does not protect routes.

### Key `lib/` modules

- `auth.ts` - Clerk session to app user, `user_profiles`, and the `require*` guards (`requireUser`, `requireWorkspaceContext`, `requireWorkspaceAdminContext`, `requireWorkspaceOwnerContext`).
- `workspaces.ts` - workspaces, members, invites, role changes, workspace deletion.
- `store.ts` - requests, triage results, tickets, activity, departments, attachment rows.
- `notifications.ts` - per-recipient in-app notifications.
- `demo.ts` - signed no-account demo session cookie, demo workspace minting, demo metering.
- `triage.ts` - Groq call, deterministic keyword fallback, safety floor.
- `security.ts` - same-origin check, salted-hash rate limiting, healthcheck token.
- `supabase.ts` - admin client factory, `SetupRequiredError`, `getRuntimeSetupStatus()`.
- `schema.ts` - Zod schemas and shared domain types.

### Route shape

Workspace routes are canonical: `/w/[workspaceSlug]/...`. The unscoped top-level routes (`app/tickets`, `app/review`, `app/requests`, `app/settings`, `app/users`, `app/notifications`) are where the page bodies actually live. Each exports a named view component (for example `TicketListView` from `app/tickets/page.tsx`) that the matching `app/w/[workspaceSlug]/...` page imports and renders with the slug.

When changing one of those pages, edit the unscoped file. Do not fork the body into the `/w/` route. Build internal links with `scopedWorkspaceHref()` from `lib/workspace-routing.ts` rather than hand-writing `/w/${slug}/...`.

## Data access

Every Supabase call goes through `requireSupabaseAdminClient()` (or `getSupabaseAdminClient()`) from `lib/supabase.ts`. Never construct a client with `createClient` anywhere else.

Table ownership is by module, not by a single write path. `auth.ts` owns `user_profiles`, `workspaces.ts` owns `workspaces` / `workspace_members` / `workspace_invites`, `notifications.ts` owns `notifications`, `demo.ts` owns demo session provisioning, and `store.ts` owns the request, triage, ticket, activity, department, and attachment tables. Write to a table from the module that owns it. Do not query tables from `app/` or `components/`.

The one deliberate exception is Supabase Storage: `app/actions.ts` uploads and removes attachment objects, and the two `attachments/[id]/route.ts` handlers mint short-lived signed URLs. Always resolve the bucket through `requestAttachmentBucket()` so upload, download, and delete agree on the name.

When adding a table to `supabase/schema.sql`, add the matching PostgREST grants in the same file. New public tables are not exposed by default.

## Conventions

### Writing

- Never use em-dashes in code, comments, docs, UI copy, SQL, or commit messages. Rewrite the sentence instead of substituting a hyphen. This is enforced by a test that walks every tracked `.ts`, `.tsx`, `.css`, `.sql`, `.md`, and `.example` file and checks the literal character plus its four HTML entity spellings.

### Server actions

Guards run in this order, and skipping one is a real hole: `assertSameOriginRequest()`, then the auth guard (`requireUser` / `assertRealActionUser` / `requireWorkspaceAdminContext`), then the demo budget (`enforceDemoTriageBudget` / `enforceDemoMutationBudget`), then `enforceRateLimit()`, then Zod validation, then the write.

Validate every action input with a Zod schema from `lib/schema.ts`.

### Authorization

Authorization is enforced in application code. Supabase RLS policies are defined but dormant, because no end-user Supabase session is issued and the app connects with the service-role key. Do not assume RLS will catch a missing check. Every workspace-scoped query must filter on `workspace_id` explicitly.

### Errors

Only `PublicError` (and `ZodError`, `RateLimitError`, `SetupRequiredError`) messages reach the UI verbatim. Everything else is replaced with a generic message by `actionErrorMessage` in `app/actions.ts`, so database and infrastructure detail never leaks. Throw `PublicError` when you want the user to read the text.

Missing configuration degrades instead of crashing: check `getRuntimeSetupStatus()` and render the "Setup required" state, the way `app/tickets/page.tsx` and `app/settings/page.tsx` do.

### Triage

- Triage must never assign Low priority to a request containing hazard language. `SAFETY_HAZARD_KEYWORDS` in `lib/triage.ts` is deliberately tight; widening it makes everything High, which is as useless as everything being Low.
- Triage must degrade to the deterministic keyword fallback rather than error, including on vague, malformed, or truncated model output. `source` records which path produced the draft (`"rules"` or `"groq"`).

### Rate limiting and privacy

Rate-limit keys are salted and hashed before storage so the table never holds raw IPs or emails. Never store an identifier unhashed, and never log a raw IP. Production refuses to start rate limiting without `RATE_LIMIT_SALT` or the service-role key as fallback.

### Demo sessions

A demo visitor is a real `AppUser` with `isDemo: true` and no `clerk_user_id`. Any action a demo visitor must not reach calls `assertRealUser(user)`. Demo limits key on the demo session id and on IP, because the cookie is free to reset.

### Styling

The design system lives in `app/globals.css`: theme tokens on `:root`, bridged to Tailwind utilities through `@theme`, with reusable component classes (`card`, `btn`, `badge`, `chip`, `page-head`, `cluster`, `stack`, `between`, `empty`, `data-row`, `row-link`, `mono`, `faint`) in `@layer components` so utilities always win over them.

Reuse those classes rather than rebuilding an equivalent out of Tailwind utilities. Dark is the default theme and light has full parity; use the semantic tokens (`var(--fg)`, `bg-surface`, `text-muted`) so both work. `cn()` from `lib/utils.ts` merges class names.

## Tests

Vitest, no jsdom or setup file. Tests sit in `lib/` as `*.test.ts` (plus `app/api/health/route.test.ts`).

Two kinds of test live here, and the second is easy to break by accident:

1. Ordinary unit tests over pure helpers, with the Supabase client stubbed via `vi.mock("@/lib/supabase", ...)`.
2. Invariant tests that read source files with `readFileSync` and assert on their text: `demo-landing.test.ts` and `demo-ux.test.ts` pin UI copy, `aria-label` values, guard ordering inside named functions, and the em-dash ban. Renaming a function, reordering guards, or rewording demo copy will fail these. Update the assertion when the change is intended; do not delete the test.
