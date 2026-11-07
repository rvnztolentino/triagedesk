## What changed

<!-- A short description of the change and why it is needed. Link the issue it closes. -->

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Chore or maintenance

## Checks

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes

## Security

- [ ] No credentials, tokens, or real project identifiers are included in the diff
- [ ] Any new route or server action touching workspace data calls a guard from `lib/auth.ts` or `lib/workspaces.ts`
- [ ] Any new user input is validated with Zod before it reaches the database
- [ ] Not applicable

## Schema

- [ ] `supabase/schema.sql` changed, and the assertions in the affected `*.test.ts` were updated to match
- [ ] Schema unchanged

## Notes for the reviewer

<!-- Anything worth calling out: tradeoffs, follow-up work, or areas you want a closer look at. -->
