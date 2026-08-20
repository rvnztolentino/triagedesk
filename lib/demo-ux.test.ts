import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demoMillisRemaining, formatDemoRemaining, isDemoExpired, DEMO_SIGNUP_HREF } from "./demo-ui";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// "This file must not X" assertions have to read the code, not the comment that
// explains why X is forbidden. Otherwise documenting the rule breaks the test.
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const actionsSource = source("../app/actions.ts");
const appLayoutSource = source("../components/app-layout.tsx");
const authSource = source("./auth.ts");
const demoBannerSource = source("../components/demo-banner.tsx");
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

  it("states that nothing is saved or carried over", () => {
    expect(demoUiSource).toContain("Nothing here is saved or carried over to an account.");
    expect(demoUiSource).toContain("Don't put anything private in it.");
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
    // ssr:false would defer the banner past hydration and pop the countdown in late.
    expect(appLayoutSource).not.toContain("ssr: false");
  });
});

describe("expired demo session", () => {
  // Without this a visitor whose demo was swept lands on /login and is asked to sign
  // in to an account they never had.
  // Presence, not validity. The common case is a token that passed its signed expiry,
  // which readDemoSessionId correctly refuses; routing on that would send the visitor
  // to a sign-in form for an account they never had.
  it("routes any demo cookie, expired included, to the expired screen instead of sign-in", () => {
    expect(authSource).toContain('if (await hasDemoSessionCookie()) redirect("/demo/expired");');
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

describe("demo sign-up, with no workspace carry-over", () => {
  // Without this the demo is a dead end: getCurrentUser resolves a demo visitor as a
  // user, so the auth pages would bounce them straight back to their workspace.
  it("lets a demo principal reach the sign-up and sign-in pages", () => {
    const guard = authSource.slice(authSource.indexOf("export async function redirectSignedInAwayFromAuth"));
    expect(guard.slice(0, guard.indexOf("\nexport "))).toContain("if (isDemoUser(user)) return;");
  });

  it("never clears a real user's active workspace from the expired screen", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function endDemoSessionAction"));
    const body = action.slice(0, action.indexOf("\nexport "));
    expect(body).toContain("if (hadDemoSession) await clearActiveWorkspaceCookie();");
  });

  it("same-origin checks the one demo action a signed-out visitor can reach", () => {
    const action = actionsSource.slice(actionsSource.indexOf("export async function endDemoSessionAction"));
    expect(action.slice(0, action.indexOf("\nexport "))).toContain("await requireTrustedActionRequest();");
  });

  // Signing up starts a fresh workspace. There is no action, helper, or RPC that
  // moves a demo workspace onto an account, and the absence is the feature.
  it("exposes no way to hand a demo workspace to an account", () => {
    for (const forbidden of ["keepDemoWorkspaceAction", "discardDemoWorkspaceAction", "claimDemoWorkspace"]) {
      expect(codeOnly(actionsSource)).not.toContain(forbidden);
      expect(codeOnly(onboardingSource)).not.toContain(forbidden);
    }
    expect(codeOnly(source("./demo.ts"))).not.toContain("claim_demo_workspace");
  });

  // The workspace hub used to lead with a keep-or-discard card for a signed-in user
  // still holding a demo cookie. It is gone, along with the cookie read behind it.
  it("drops the keep-or-discard card from the workspace hub", () => {
    expect(codeOnly(onboardingSource)).not.toContain("canKeepDemoWorkspace");
    expect(codeOnly(onboardingSource)).not.toContain("readDemoSessionId");
  });

  // The failure this guards is not a crash, it is a lie: copy that promises the
  // workspace survives sign-up when nothing in the code can deliver that.
  it("promises nowhere that the demo workspace survives sign-up", () => {
    const claims = [
      "comes with you",
      "keep this workspace",
      "Keep your demo workspace",
      "as you left it",
      "becomes a real one",
      "still in it",
      "Sign up to keep it",
      "Make it permanent",
    ];
    const surfaces: Array<[string, string]> = [
      ["lib/demo-ui.ts", demoUiSource],
      ["components/demo-banner.tsx", demoBannerSource],
      ["components/app-layout.tsx", appLayoutSource],
      ["app/onboarding/page.tsx", onboardingSource],
      ["app/w/[workspaceSlug]/page.tsx", manageWorkspaceSource],
      ["app/submit/confirm/page.tsx", confirmSource],
      ["app/demo/expired/page.tsx", expiredPageSource],
    ];

    const offenders: string[] = [];
    for (const [name, src] of surfaces) {
      for (const claim of claims) {
        if (src.includes(claim)) offenders.push(`${name}: ${claim}`);
      }
    }
    expect(offenders).toEqual([]);
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

  // A real account keeps its account settings; a demo session gets the sign-up call
  // to action in that slot, so there is no blocked affordance left to explain either.
  it("swaps account settings for the sign-up call to action in a demo session", () => {
    const menu = appLayoutSource.slice(appLayoutSource.indexOf('id="app-profile-menu"'));
    const body = menu.slice(0, menu.indexOf("handleSignOut"));
    expect(body).toMatch(/isDemoSession \? \([\s\S]*?DEMO_SIGNUP_HREF[\s\S]*?\) : \([\s\S]*?href="\/account"/);
    expect(body).not.toContain("DemoLockButton");
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
    for (const file of [appLayoutSource, demoBannerSource, expiredPageSource, onboardingSource, confirmSource, manageWorkspaceSource]) {
      expect(file).toContain("DEMO_SIGNUP_HREF");
    }
  });
});
