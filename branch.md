# Branch Strategy and Progress

Active task source: Security Officer review remediation — complete error handling +
monitoring (the review found the app otherwise well-hardened; the one real gap was
incomplete error handling that surfaced as fatal Next.js error pages).

This is one cohesive remediation (shared error mapper + graceful actions + error
boundaries + Sentry reporting), not independently deliverable in pieces, so it is
delivered on one branch: fix/error-handling-monitoring (built on fix/triage-submit-errors).

## fix/error-handling-monitoring
Branch status: Completed
PR status: Not Started
Scope:
- New `lib/errors.ts`: client-safe `ActionState` type + `PublicError` class (messages
  safe to show users). Server-only deps kept out so client components can
  `import type { ActionState }`.
- `app/actions.ts`: generalized the submit error mapper to `actionErrorMessage` (now also
  passes `PublicError` through; generic fallback for everything else so DB/infra details
  never leak). `redirectWithError` and the email-verification action use it. Converted
  `approve`/`reject`/`markDuplicate`/`updateTicket`/`reset` actions to the graceful
  return-`{error}` pattern (redirect kept outside try/catch; logged via
  `captureOperationalError`).
- `lib/auth.ts`: curated user-facing throws (sign-in/sign-up/verify-email) now throw
  `PublicError` so they survive the generic-fallback mapper.
- Admin forms converted to `useActionState` with inline `st-danger` alerts:
  new `components/review-decision-form.tsx` (dual approve/reject via two hooks) and
  `components/ticket-update-form.tsx`; updated `components/duplicate-review-form.tsx`
  (note: `DuplicateReviewForm` is currently rendered nowhere — dead code, updated for
  correctness) and `components/submit-request-form.tsx` (shared `ActionState`).
- Error boundaries: new `app/error.tsx` (segment retry) and `app/global-error.tsx`
  (root, self-contained inline styles), both report to Sentry via `captureException`.
Completed work: All scope above. typecheck clean; eslint clean on all changed/new files;
  `next build` succeeds; tests 43 pass (the 2 `lib/workspaces.test.ts` light-mode-CSS
  failures are pre-existing and unrelated, confirmed on the clean tree). Note: a
  pre-existing eslint error in `app/tickets/tickets-table-shell.tsx` (set-state-in-effect)
  is untouched by this work.
Remaining work: None in code. Operational follow-up: confirm `NEXT_PUBLIC_SENTRY_DSN` +
  `SENTRY_DSN` are set in Vercel production env (likely why the original crash was not
  captured). Optional later: apply the same inline pattern to `updateUserRoleAction`
  (currently caught by the new route error boundary).
Dependencies: Builds on fix/triage-submit-errors (submit graceful handling + DB
  constraint self-heal).
Can merge independently: Yes (or stacked after fix/triage-submit-errors).
Resume notes: Per rules — not pushed, no remote branch, no PR opened.

## fix/triage-submit-errors (previous task source)
Active task source: fix the AI triage submit crash (ai_triage_results_source_check
constraint violation + ungraceful server error on the submit form).

This is one cohesive bug fix (a stale DB constraint plus the missing error handling
that exposes it as a fatal page), not independently deliverable in pieces, so it is
delivered on one branch: fix/triage-submit-errors.

## fix/triage-submit-errors
Branch status: Completed
PR status: Not Started
Scope:
- Root cause: `runTriage` falls back to `rulesTriage` (source "rules") whenever the
  Groq call fails/returns unparseable JSON (e.g. vague input like "help bro im
  stuck"). The live DB's `ai_triage_results_source_check` predates the rules
  fallback and only permits 'groq', so the fallback insert is rejected. `schema.sql`
  creates the table with `create table if not exists` and had no migration to
  re-sync the constraint, so re-running it never fixed existing deployments.
- DB: added an idempotent drop/re-add of `ai_triage_results_source_check` in
  `supabase/schema.sql` so existing databases accept both 'rules' and 'groq'.
- UX: `submitRequestAction` now returns a `SubmitRequestState` error instead of
  throwing (redirect kept outside the try/catch); extracted the form into a client
  component `components/submit-request-form.tsx` using `useActionState` that renders
  an inline `st-danger` alert. Validation/rate-limit/setup errors surface their
  message; unexpected errors (e.g. DB) show a generic retry message and are logged
  via `captureOperationalError`.
Completed work: All scope above. typecheck clean, eslint clean, `next build`
  succeeds (40 routes). Test suite: 43 pass; the 2 failures in
  lib/workspaces.test.ts are pre-existing (light-mode CSS strings removed by the UI
  overhaul) and unrelated to this change.
Remaining work: User must re-run `supabase/schema.sql` against the live database to
  apply the constraint fix.
Dependencies: None.
Can merge independently: Yes.
Resume notes: Per rules — not pushed, no remote branch, no PR opened.

## feat/ui-overhaul (previous task source)
Active task source: complete UI overhaul (strict-minimalist Geist redesign of the
entire visual layer; functionality preserved 100%).

This work is a single, cohesive visual layer that is not independently deliverable in
pieces (a half-migrated token system would leave broken styling), so it is delivered on
one branch.

Branch status: Completed
PR status: Not Started
Scope:
- Replace the brittle styling foundation (emerald-class→accent override hack + ~200
  lines of per-class light-mode overrides) with a semantic CSS custom-property token
  system mapped into Tailwind v4 `@theme` (`bg-bg`, `bg-surface`, `border-border`,
  `text-fg`, `text-muted`, `text-accent`, `bg-accent-soft`, status `.st-*` classes…).
- Fonts: Geist + Geist Mono via `next/font/google` (mono for IDs/codes/timestamps/
  metrics). Dark default with full light-mode parity. Olive `#879D5A` default accent
  preserved; color selector restyled and still writes a single `--accent` property
  that propagates system-wide in both themes.
- Hairline 1px ~11% borders, no card shadows, zero decorative elements.
- Rewrote every component, layout, table, modal/popup, button, input, badge, nav,
  the landing page (removed the "Built for operations teams" badge, no replacement),
  and all inner pages (auth, onboarding, workspace, dashboard, tickets, review,
  submit, settings, users). Scoped `/w/[slug]/*` pages re-export the same Views.
Completed work: All scope above. typecheck clean, eslint clean, `next build`
  succeeds (40 routes), dev server serves landing (200) with badge removed and all
  copy intact; Geist font vars + inline theme script + token CSS verified in output.
Remaining work: None.
Dependencies: None.
Can merge independently: Yes.
Resume notes: All functionality preserved (server actions, guards, form field names,
  useFormStatus/useTransition/useSyncExternalStore wiring, click-outside/Escape,
  routing helpers, isPreview locks unchanged). Manual interactive QA in a browser
  (theme toggle, color picker drag, full request→review→ticket flow) recommended
  before opening a PR. Per rules: not pushed, no remote branch, no PR opened.
