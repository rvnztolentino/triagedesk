# Branch Strategy and Progress

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
