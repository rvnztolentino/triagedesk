import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const actionsSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
const demoSource = readFileSync(new URL("./demo.ts", import.meta.url), "utf8");
// Both download routes must be guarded. The workspace-scoped one is what the app
// actually links to; the unscoped one is still reachable directly.
const attachmentRouteSources = [
  readFileSync(new URL("../app/attachments/[id]/route.ts", import.meta.url), "utf8"),
  readFileSync(new URL("../app/w/[workspaceSlug]/attachments/[id]/route.ts", import.meta.url), "utf8"),
];
const joinPageSource = readFileSync(new URL("../app/join/[workspaceSlug]/page.tsx", import.meta.url), "utf8");
const accountPageSource = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");

const SESSION_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function importDemo(secret = "test-demo-secret") {
  vi.stubEnv("DEMO_SESSION_SECRET", secret);
  vi.resetModules();
  return import("./demo");
}

describe("demo session cookie", () => {
  it("round-trips a session id it signed itself", async () => {
    const { createDemoSessionToken, verifyDemoSessionToken } = await importDemo();

    expect(verifyDemoSessionToken(createDemoSessionToken(SESSION_ID))).toBe(SESSION_ID);
  });

  // The signature is the only thing separating two demo visitors. Without it, anyone
  // could set a cookie naming another visitor's session id and open their workspace.
  it("rejects a session id whose signature was tampered with", async () => {
    const { createDemoSessionToken, verifyDemoSessionToken } = await importDemo();
    const token = createDemoSessionToken(SESSION_ID);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifyDemoSessionToken(tampered)).toBeUndefined();
  });

  it("rejects another session id pasted onto a valid signature", async () => {
    const { createDemoSessionToken, verifyDemoSessionToken } = await importDemo();
    const signature = createDemoSessionToken(SESSION_ID).split(".")[1];

    expect(verifyDemoSessionToken(`11111111-1111-4111-8111-111111111111.${signature}`)).toBeUndefined();
  });

  it("rejects a token signed with a different secret", async () => {
    const { createDemoSessionToken } = await importDemo("first-secret");
    const token = createDemoSessionToken(SESSION_ID);
    const { verifyDemoSessionToken } = await importDemo("rotated-secret");

    expect(verifyDemoSessionToken(token)).toBeUndefined();
  });

  it("rejects malformed tokens instead of throwing", async () => {
    const { verifyDemoSessionToken } = await importDemo();

    for (const token of [undefined, "", "no-dot", `${SESSION_ID}.`, `${SESSION_ID}.a.b`, ".sig"]) {
      expect(verifyDemoSessionToken(token)).toBeUndefined();
    }
  });

  // The session id reaches a SQL slug and an email address, so anything that is not a
  // uuid is refused before it can be signed or trusted.
  it("rejects a signed token whose session id is not a uuid", async () => {
    const { verifyDemoSessionToken, createDemoSessionToken } = await importDemo();

    expect(verifyDemoSessionToken(createDemoSessionToken("../../etc/passwd"))).toBeUndefined();
    expect(verifyDemoSessionToken(createDemoSessionToken("' or 1=1--"))).toBeUndefined();
  });
});

describe("demo availability", () => {
  // Fail closed: no secret means signatures cannot be trusted, so the demo must be off
  // rather than running with unsigned cookies.
  it("stays disabled when no signing secret is configured", async () => {
    vi.stubEnv("DEMO_SESSION_SECRET", "");
    vi.resetModules();
    const { isDemoEnabled } = await import("./demo");

    expect(isDemoEnabled()).toBe(false);
  });

  it("honours the kill switch even when a secret is present", async () => {
    vi.stubEnv("DEMO_SESSION_SECRET", "test-demo-secret");
    vi.stubEnv("DEMO_ENABLED", "false");
    vi.resetModules();
    const { isDemoEnabled } = await import("./demo");

    expect(isDemoEnabled()).toBe(false);
  });

  it("is enabled with a secret and no kill switch", async () => {
    vi.stubEnv("DEMO_SESSION_SECRET", "test-demo-secret");
    vi.stubEnv("DEMO_ENABLED", "");
    vi.resetModules();
    const { isDemoEnabled } = await import("./demo");

    expect(isDemoEnabled()).toBe(true);
  });

  it("keeps demo emails inside the reserved .invalid TLD", async () => {
    const { demoProfileEmail, isDemoEmail } = await importDemo();

    expect(demoProfileEmail(SESSION_ID)).toBe(`demo-${SESSION_ID}@demo.invalid`);
    expect(isDemoEmail(demoProfileEmail(SESSION_ID))).toBe(true);
    expect(isDemoEmail("someone@example.com")).toBe(false);
  });

  // The secret signs session cookies; exposing it through a NEXT_PUBLIC_ variable
  // would let any visitor mint a cookie for any demo workspace.
  it("never reads the signing secret from a client-exposed variable", () => {
    expect(demoSource).toContain("process.env.DEMO_SESSION_SECRET");
    expect(demoSource).not.toContain("NEXT_PUBLIC_DEMO");
  });

  // .env.example is the canonical list of what has to be configured. A variable the
  // app requires but the example file never mentions is a setup step nobody performs.
  it("documents both demo variables in .env.example", () => {
    const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

    expect(envExample).toContain("DEMO_SESSION_SECRET=");
    expect(envExample).toContain("DEMO_ENABLED=");
    // The secret signs session cookies; committing a real one would hand out every
    // demo workspace, so the example must ship it blank.
    expect(envExample).toMatch(/^DEMO_SESSION_SECRET=\s*$/m);
    expect(envExample).not.toContain("NEXT_PUBLIC_DEMO_SESSION_SECRET");
  });

  it("sets the demo cookie HttpOnly, SameSite=Lax, and Secure in production", () => {
    expect(demoSource).toContain("httpOnly: true");
    expect(demoSource).toContain('sameSite: "lax"');
    expect(demoSource).toContain('secure: process.env.NODE_ENV === "production"');
  });
});

describe("demo identity resolution", () => {
  // Resolving the demo principal inside getCurrentUser is what lets every existing
  // guard keep working unmodified. It must stay on the "no Clerk user" branch so a
  // signed-in user's resolution is completely unchanged.
  it("falls back to a demo principal only when Clerk returns no user", () => {
    expect(authSource).toContain("if (!userId) {");
    expect(authSource).toContain("return getDemoUser();");
  });

  it("keeps getCurrentUser cached so the demo branch adds no per-request lookup", () => {
    expect(authSource).toContain("export const getCurrentUser = cache(async ()");
  });

  // isDemo is required on AppUser rather than optional: a demo principal that silently
  // defaulted to "real" would walk straight through the deny-list.
  it("forces every AppUser to declare whether it is a demo principal", () => {
    const schemaSource = readFileSync(new URL("./schema.ts", import.meta.url), "utf8");
    expect(schemaSource).toMatch(/export interface AppUser \{[^}]*isDemo: boolean;/);
  });

  it("gives a demo principal no platform role beyond requester", () => {
    expect(demoSource).toContain('role: "requester"');
  });
});

describe("demo deny-list", () => {
  const blockedActions = [
    "createWorkspaceAction",
    "joinWorkspaceAction",
    "createWorkspaceInviteAction",
    "revokeWorkspaceInviteAction",
    "deleteWorkspaceInviteAction",
    "leaveWorkspaceAction",
    "removeWorkspaceMemberAction",
    "deleteWorkspaceAction",
    "updateUserRoleAction",
    "updateAccountNameAction",
    "deleteAccountAction",
    "resetWorkspaceDataAction",
  ];

  // One assertion per deny-list entry. Each of these is an action a demo principal is
  // now accepted by (because getCurrentUser resolves it like any other user), so each
  // needs its own explicit block.
  it.each(blockedActions)("blocks %s for demo principals", (actionName) => {
    const body = actionsSource.slice(actionsSource.indexOf(`export async function ${actionName}(`));
    const end = body.indexOf("\nexport async function ");
    expect(end === -1 ? body : body.slice(0, end)).toContain("assertRealUser(");
  });

  it.each([0, 1])("denies attachment downloads before a signed storage URL is minted (route %i)", (index) => {
    const source = attachmentRouteSources[index];
    expect(source).toContain("if (isDemoUser(user)) {");
    expect(source).toContain("status: 403");
    expect(source.indexOf("isDemoUser(user)")).toBeLessThan(source.indexOf("createSignedUrl"));
  });

  it("denies attachment uploads on the submit path", () => {
    expect(actionsSource).toContain("if (attachments.length > 0) assertRealUser(user);");
  });

  it("sends demo principals to sign in rather than showing the invite join form", () => {
    expect(joinPageSource).toContain("if (!user || isDemoUser(user)) redirect(");
  });

  it("keeps account settings out of reach of a demo principal", () => {
    expect(accountPageSource).toContain("await requireRealUser()");
  });

  it("drops the demo cookie on sign out", () => {
    expect(actionsSource).toContain("await clearDemoSessionCookie();");
  });
});

describe("demo rate limits", () => {
  // Four layers because each alone is defeatable: the cookie is resettable, so the IP
  // caps are the real ceiling and the global cap is what bounds the AI bill.
  it("meters demo workspace creation by IP and by a global daily budget", () => {
    expect(demoSource).toContain('scope: "demo_workspace_create_ip"');
    expect(demoSource).toContain('scope: "demo_workspace_create_global"');
  });

  it("meters demo triage by session, by IP, and against a global daily budget", () => {
    expect(demoSource).toContain('scope: "demo_triage_session"');
    expect(demoSource).toContain('scope: "demo_triage_ip"');
    expect(demoSource).toContain('scope: "demo_triage_global"');
    expect(demoSource).toContain('keyParts: ["global"]');
  });

  it("bounds row growth from a demo session's writes", () => {
    expect(demoSource).toContain('scope: "demo_write_session"');
    expect(actionsSource).toContain("await enforceDemoMutationBudget(user);");
    expect(actionsSource).toContain("await enforceDemoTriageBudget(user);");
  });

  it("refuses to start a demo session when the demo is disabled", () => {
    expect(demoSource).toContain("if (!isDemoEnabled()) {");
    expect(demoSource).toContain("The live demo is unavailable right now.");
  });

  // The demo entry point is the one endpoint an anonymous visitor can reach that
  // writes rows, so the same-origin check lives here rather than only in the caller.
  it("same-origin checks the demo entry point before any row is written", () => {
    expect(demoSource).toContain("await assertSameOriginRequest();");
    expect(demoSource.indexOf("await assertSameOriginRequest();")).toBeLessThan(
      demoSource.indexOf('client.rpc("create_demo_workspace"')
    );
  });

  // If the clone fails the visitor must be left with no cookie at all, rather than one
  // pointing at a workspace that was never created.
  it("sets the session cookie only after the workspace exists", () => {
    expect(demoSource.indexOf('client.rpc("create_demo_workspace"')).toBeLessThan(
      demoSource.indexOf("await setDemoSessionCookie(sessionId);")
    );
  });
});
