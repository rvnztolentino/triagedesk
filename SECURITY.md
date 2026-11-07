# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for a security vulnerability.

Report it privately through GitHub's [private vulnerability reporting](https://github.com/rvnztolentino/triagedesk/security/advisories/new). If that is unavailable to you, open a regular issue that says only that you have a security report and asks for a contact channel. Leave out the details.

Include what you can:

- What the issue is and which files or routes are involved
- Steps to reproduce, or a proof of concept
- What an attacker gains
- The commit or deployed version you tested

Expect an acknowledgement within 7 days and an assessment within 30. TriageDesk is a personal project maintained in spare time, so there is no formal SLA beyond that.

## Supported Versions

Only `main` is supported. There are no backported security releases.

## Scope

In scope:

- Authentication and session handling
- Workspace authorization and cross-workspace data access
- Request, ticket, and attachment access control
- The AI triage path, including prompt injection that changes triage outcomes
- Rate limiting and abuse controls
- The live demo workspace and its session cookie

Out of scope:

- Vulnerabilities in Clerk, Supabase, Groq, or Vercel themselves. Report those to the vendor.
- Missing hardening headers with no demonstrated impact
- Automated scanner output with no working proof of concept
- Social engineering, physical attacks, and denial of service through raw volume

## Known Design Limitations

These are deliberate and documented, not undiscovered bugs. Please do not report them as vulnerabilities. Anyone deploying TriageDesk should read them first.

**Authorization lives in application code, not in the database.** Row-level security is enabled on every table, but the policies target `auth.uid()`, which no longer resolves after the migration to Clerk. Every query runs through the service-role client, which bypasses RLS entirely. The guards in `lib/auth.ts` and `lib/workspaces.ts` are the only authorization boundary, so a route that forgets one has no database backstop. Direct REST access is still closed: the anon key is not used, and RLS with non-resolving policies denies by default.

**Account enumeration on the auth forms is intentional.** Sign-in and sign-up error copy discloses whether an email is already registered. This is a usability trade, made knowingly.

**The AI safety floor is keyword-based.** Hazard language raises priority to `high` on both the model and rules paths. Because it matches keywords, unusual phrasing can slip past it and harmless phrasing can trip it. It is a floor, not a classifier, and it is not a safety guarantee.

**Triage confidence is presentational.** The confidence bar is derived deterministically from the record ID. It is not a model-produced confidence score and carries no signal.

## Deploying Safely

If you run your own instance:

- Set `RATE_LIMIT_SALT` to a unique random value. Without it the app falls back to the service-role key, and in production it now refuses the published development salt outright.
- Set `DEMO_SESSION_SECRET` only if you want the public demo. Leaving it blank disables the demo, which is the safe default.
- Keep `CLERK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only. Never prefix either with `NEXT_PUBLIC_`.
- Keep the `request-attachments` storage bucket private.
- Set `HEALTHCHECK_TOKEN` in production so `/api/health` does not disclose configuration state.
- Rotate every key that has ever been pasted into a chat, screenshot, or issue.
