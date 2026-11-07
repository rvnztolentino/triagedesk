# Contributing to TriageDesk

Thanks for taking a look. This is a personal project, so please open an issue before starting anything large. A small fix can go straight to a pull request.

## Getting Set Up

TriageDesk needs Node 24, pnpm 10, and accounts on Clerk, Supabase, and Groq. All three have free tiers that cover local development.

```sh
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`, run `supabase/schema.sql` in the Supabase SQL editor, then:

```sh
pnpm dev
```

`README.md` has the full setup walkthrough. Visit `/api/health` to confirm your configuration resolves.

## Before You Open a Pull Request

All four must pass. CI runs exactly these:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Conventions

- **Branches:** `feat/`, `fix/`, `chore/`, `refactor/`, `test/`, or `docs/` followed by a short description.
- **Commits:** a conventional prefix (`feat:`, `fix:`, `style:`, `docs:`, `chore:`), then imperative mood, lowercase, no trailing period. For example `fix: show request attachments on the ticket page`.
- **TypeScript:** strict mode, no `any`, no non-null assertions without a comment explaining why the invariant holds.
- **Comments:** explain why, not what. Match the density already in the file.
- **No em-dashes** in code, comments, or documentation. Rewrite the sentence instead.

## Where Things Live

| Path | What it holds |
| --- | --- |
| `app/` | App Router routes, server actions, API handlers |
| `components/` | React components, client and server |
| `lib/` | Business logic, data access, auth, triage, validation |
| `supabase/` | Idempotent schema plus maintenance SQL |

## Testing

Tests run under Vitest and live next to what they test, as `*.test.ts`.

Several suites assert against the literal text of `supabase/schema.sql`. If you change the schema, update the matching assertion in the same commit. That is intentional: it keeps the checked-in schema and the code's assumptions from drifting apart silently.

Cover the failure path, not only the happy one. Anything touching auth, workspace scoping, rate limiting, or attachments needs a test showing the deny case actually denies.

## Security Changes

Read `SECURITY.md` first, especially the known design limitations.

Authorization is enforced in application code, not by the database. Any new route or server action that touches workspace data must call the appropriate guard in `lib/auth.ts` or `lib/workspaces.ts`. There is no database backstop to catch a missed check.

Never commit real credentials. `.env.local` is gitignored. Report vulnerabilities privately as described in `SECURITY.md` rather than opening a public issue.
