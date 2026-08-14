import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demoMillisRemaining, formatDemoRemaining, isDemoExpired, DEMO_SIGNUP_HREF } from "./demo-ui";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// "This file must not X" assertions have to read the code, not the comment that
// explains why X is forbidden — otherwise documenting the rule breaks the test.
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const actionsSource = source("../app/actions.ts");
const appLayoutSource = source("../components/app-layout.tsx");
const authSource = source("./auth.ts");
const demoBannerSource = source("../components/demo-banner.tsx");
const demoLockSource = source("../components/demo-lock.tsx");
const demoUiSource = source("./demo-ui.ts");
const expiredPageSource = source("../app/demo/expired/page.tsx");
const onboardingSource = source("../app/onboarding/page.tsx");
const manageWorkspaceSource = source("../app/w/[workspaceSlug]/page.tsx");
const confirmSource = source("../app/submit/confirm/page.tsx");
const robotsSource = source("../app/robots.ts");
const rootLayoutSource = source("../app/layout.tsx");
const workspacesSource = source("./workspaces.ts");

const NOW = Date.UTC(2026, 7, 14, 12, 0, 0);
const atOffset = (ms: number) => new Date(NOW + ms).toISOString();

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe("demo countdown formatting", () => {
  it.each([
    [23 * HOUR + 41 * MINUTE, "23h 41m"],
    [HOUR, "1h"],
    [HOUR + 30 * 1000, "1h"],
    [41 * MINUTE, "41m"],
    [MINUTE, "1m"],
    [30 * 1000, "under a minute"],
    [0, "any moment now"],
    [-5 * HOUR, "any moment now"],
  ])("renders %ims remaining as %s", (offset, expected) => {
    expect(formatDemoRemaining(atOffset(offset), NOW)).toBe(expected);
  });

  // The banner drops the countdown clause entirely rather than printing "resets in
  // NaN" when the workspace row carries no usable expiry.
  it("returns undefined for a missing or unparseable expiry", () => {
    expect(formatDemoRemaining(undefined, NOW)).toBeUndefined();
    expect(formatDemoRemaining("not-a-date", NOW)).toBeUndefined();
    expect(demoMillisRemaining(undefined, NOW)).toBeUndefined();
  });

  it("treats only a past expiry as expired", () => {
    expect(isDemoExpired(atOffset(HOUR), NOW)).toBe(false);
    expect(isDemoExpired(atOffset(-1), NOW)).toBe(true);
    expect(isDemoExpired(undefined, NOW)).toBe(false);
  });

  // demo-ui is imported by client components. A server-only import here (node:crypto,
  // next/headers, the Supabase client) would break the build the moment the banner
  // renders, so keep the module dependency-free the way lib/errors.ts is.
  it("stays free of server-only imports so client components can use it", () => {
    const code = codeOnly(demoUiSource);
    expect(code).not.toContain("next/headers");
    expect(code).not.toContain("node:crypto");
    expect(code).not.toContain("@/lib/supabase");
    expect(code).not.toMatch(/^import .* from "\.\/demo";$/m);
  });
});

describe("demo banner", () => {
  // Server and client clocks differ by definition, so a countdown computed on both
  // sides would mismatch on hydration. The server's label is the first render.
  it("takes its first label from the server instead of computing one at hydration", () => {
    expect(demoBannerSource).toContain("React.useState(initialLabel)");
    expect(rootLayoutSource).toContain("remainingLabel: formatDemoRemaining(");
  });

  it("ticks once a minute rather than once a second", () => {
    expect(demoBannerSource).toContain("const TICK_MS = 60 * 1000;");
    expect(demoBannerSource).toContain("window.setInterval(update, TICK_MS)");
    expect(demoBannerSource).toContain("window.clearInterval(timer)");
  });

  it("states that the workspace is temporary and auto-deleted", () => {
    expect(demoUiSource).toContain("Temporary workspace — auto-deleted.");
    expect(demoBannerSource).toContain("DEMO_PRIVACY_NOTE");
  });

  // Keyed off the principal, not the active-workspace cookie: a demo visitor who
  // reaches a page before that cookie is set must still see the banner.
  it("renders for any demo principal, not only when a demo workspace is active", () => {
    expect(appLayoutSource).toContain("const isDemoSession = currentUser?.isDemo === true;");
    expect(appLayoutSource).toContain("{isDemoSession ? <DemoBanner");
  });

  // The countdown comes off the workspace row the layout already loads. A separate
  // lookup would add a query to every authenticated request in the app.
  it("reads the expiry off the existing workspace select rather than a new query", () => {
    expect(workspacesSource).toContain("isDemo: row.is_demo === true,");
    expect(workspacesSource).toContain("expiresAt: row.expires_at ? asString(row.expires_at) : undefined,");
    expect(rootLayoutSource).not.toContain("getWorkspaceById");
  });

  // The app shell is the client bundle for every route, the landing page included.
  // Static imports here would ship the demo chrome to logged-out visitors who can
  // never render it.
  it("code-splits the demo chrome out of the shell everyone downloads", () => {
    expect(appLayoutSource).toContain('const DemoBanner = dynamic(() => import("@/components/demo-banner")');
    expect(appLayoutSource).toContain('const DemoLockButton = dynamic(() => import("@/components/demo-lock")');
    // ssr:false would defer the banner past hydration and pop the countdown in late.
    expect(appLayoutSource).not.toContain("ssr: false");
  });
});

describe("expired demo session", () => {
  // Without this a visitor whose demo was swept lands on /login and is asked to sign
  // in to an account they never had.
  it("routes a stale demo cookie to the expired screen instead of sign-in", () => {
    expect(authSource).toContain('if (await readDemoSessionId()) redirect("/demo/expired");');
    expect(authSource.indexOf('redirect("/demo/expired")')).toBeLessThan(
      authSource.indexOf('redirect("/login")')
    );
  });

  // The screen is reached precisely because requireUser sent the visitor here; calling
  // it again from the page would redirect to itself forever.
  it("never calls requireUser from the expired page", () => {
    expect(codeOnly(expiredPageSource)).not.toContain("requireUser");
  });

  it("clears the dead cookie through an action rather than a link", () => {
    expect(expiredPageSource).toContain("action={endDemoSessionAction}");
    expect(actionsSource).toContain("export async function endDemoSessionAction()");
    expect(actionsSource).toMatch(/endDemoSessionAction\(\) \{[^}]*await clearDemoSessionCookie\(\);/);
  });

  it("is noindex and excluded from crawlers", () => {
    expect(expiredPageSource).toContain("robots: { index: false, follow: false }");
    expect(robotsSource).toContain('"/demo/"');
  });
});

describe("demo sign-up conversion", () => {
  // Without this the demo is a dead end: getCurrentUser resolves a demo visitor as a
  // user, so the auth pages would bounce them straight back to their workspace.
  it("lets a demo principal reach the sign-up and sign-in pages", () => {
    const guard = authSource.slice(authSource.indexOf("export async function redirectSignedInAwayFromAuth"));
    expect(guard.slice(0, guard.indexOf("\nexport "))).toContain("if (isDemoUser(user)) return;");
  });

  it("offers the claim only to a real account holding a demo cookie", () => {
    expect(onboardingSource).toContain("const canKeepDemoWorkspace = !isDemo && Boolean(demoSessionId);");
    expect(onboardingSource).toContain("action={keepDemoWorkspaceAction}");
    expect(onboardingSource).toContain("action={discardDemoWorkspaceAction}");
  });

  // The session id comes from the visitor's own signed cookie, never from the form.
  // A claim keyed on a submitted id would let anyone hand themselves somebody else's
  // demo workspace by guessing or replaying a session id.
  it("takes the claimed session from the signed cookie, not from the request", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function keepDemoWorkspaceAction"));
    const body = action.slice(0, action.indexOf("\nexport "));
    expect(body).not.toContain("formData");
    expect(body).toContain("claimDemoWorkspace(user.id)");

    const demoSource = source("./demo.ts");
    const claim = demoSource.slice(demoSource.indexOf("export async function claimDemoWorkspace"));
    expect(claim).toContain("const sessionId = await readDemoSessionId();");
  });

  it("never clears a real user's active workspace from the expired screen", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function endDemoSessionAction"));
    const body = action.slice(0, action.indexOf("\nexport "));
    expect(body).toContain("if (hadDemoSession) await clearActiveWorkspaceCookie();");
  });

  it("refuses to claim a workspace for a demo principal", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function keepDemoWorkspaceAction"));
    const body = action.slice(0, action.indexOf("\nexport "));
    expect(body).toContain("if (isDemoUser(user)) {");
    expect(body).toContain("await claimDemoWorkspace(user.id);");
  });

  // The demo workspace is left to its own expiry. Deleting it here would destroy work
  // a visitor might still want, and the sweep already collects it.
  it("discards only the cookie, never the workspace", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function discardDemoWorkspaceAction"));
    const body = action.slice(0, action.indexOf("\nexport "));
    expect(body).toContain("await clearDemoSessionCookie();");
    expect(body).not.toContain("deleteWorkspace");
  });

  it("same-origin checks every demo conversion entry point", () => {
    for (const name of ["keepDemoWorkspaceAction", "discardDemoWorkspaceAction", "endDemoSessionAction"]) {
      const action = actionsSource.slice(actionsSource.indexOf(`export async function ${name}`));
      const body = action.slice(0, action.indexOf("\nexport "));
      expect(body).toContain("await requireTrustedActionRequest();");
    }
  });

  // The RPC hardcodes the cap; the hub disables the button using the app-side
  // constant. If the two drift, the visitor gets a raw database error instead.
  it("gates the keep button on the same workspace cap the RPC enforces", () => {
    const schemaSql = source("../supabase/schema.sql");
    const claim = schemaSql.slice(schemaSql.indexOf("create or replace function claim_demo_workspace"));
    expect(claim.slice(0, claim.indexOf("$$;"))).toContain(">= 3 then");
    expect(workspacesSource).toContain("export const MAX_WORKSPACES_PER_USER = 3;");
    expect(onboardingSource).toContain('disabled={atWorkspaceLimit}');
  });
});

describe("blocked-action affordances", () => {
  // Every one of these is already refused server-side and again in the database. The
  // UI change is about not rendering controls that are guaranteed to fail.
  it("hides invite management and the danger zone from a demo owner", () => {
    expect(manageWorkspaceSource).toContain("const canManageInvites = !isPreview && !isDemo && isWorkspaceAdmin(membership.role);");
    expect(manageWorkspaceSource).toContain('membership.role === "owner" && !isPreview && !isDemo ?');
  });

  it("replaces the create and join forms on the workspace hub for demo visitors", () => {
    expect(onboardingSource).toContain("const isDemo = isDemoUser(user);");
    expect(onboardingSource).toContain("{isDemo ? (");
  });

  it("explains account settings in a dialog rather than redirecting silently", () => {
    expect(appLayoutSource).toContain("<DemoLockButton className=\"menu-item\"");
    expect(demoLockSource).toContain('role="dialog"');
    expect(demoLockSource).toContain('aria-modal="true"');
    expect(demoLockSource).toContain('if (event.key === "Escape") setOpen(false);');
  });

  it("labels sign-out as ending the demo and skips the Clerk session teardown", () => {
    expect(appLayoutSource).toContain('{isDemoSession ? "End demo" : "Sign out"}');
    expect(appLayoutSource).toContain("if (isDemoSession) {");
  });

  it("nudges sign-up right after the visitor's first real triage", () => {
    expect(confirmSource).toContain("{isDemoUser(user) ? (");
    expect(confirmSource).toContain("That was real AI triage");
  });

  // One constant behind every call to action, so the banner, the dialog, the hub, and
  // the expired screen cannot drift to different destinations.
  it("sends every demo call to action to the same sign-up destination", () => {
    expect(DEMO_SIGNUP_HREF).toBe("/signup?next=/onboarding");
    for (const file of [appLayoutSource, demoBannerSource, demoLockSource, expiredPageSource, onboardingSource, confirmSource, manageWorkspaceSource]) {
      expect(file).toContain("DEMO_SIGNUP_HREF");
    }
  });
});
