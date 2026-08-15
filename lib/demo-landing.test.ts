import { readdirSync, readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

let membershipClient: SupabaseClient;

vi.mock("@/lib/supabase", () => ({
  requireSupabaseAdminClient: () => membershipClient,
}));

// Records the filters requireWorkspaceMembership puts on the query, so the test can
// assert what the database was actually asked, not just what it answered.
function stubMembershipClient(row: unknown) {
  const filters: Array<[string, string]> = [];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (column: string, value: string) => {
    filters.push([column, value]);
    return builder;
  };
  builder.maybeSingle = async () => ({ data: row, error: null });
  const from = vi.fn(() => builder);
  membershipClient = { from } as unknown as SupabaseClient;
  return { filters, from };
}

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// "This file must not contain X" has to read the code, not the comment explaining
// why X is forbidden. Otherwise documenting the rule breaks the test.
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const occurrences = (src: string, needle: string) => src.split(needle).length - 1;

// Slices one function out of a module so an ordering assertion ("A happens before B")
// can't be satisfied by an unrelated A somewhere else in the file.
const functionSource = (src: string, name: string) => {
  const start = src.indexOf(`async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const rest = src.slice(start + 1);
  const nextDecl = rest.search(/\n(export )?(async )?function /);
  return nextDecl === -1 ? rest : rest.slice(0, nextDecl);
};

const actionsSource = source("../app/actions.ts");
const buttonSource = source("../components/try-demo-button.tsx");
const headerSource = source("../components/home-header.tsx");
const landingSource = source("../app/page.tsx");
const expiredPageSource = source("../app/demo/expired/page.tsx");
const sitemapSource = source("../app/sitemap.ts");
const submitPageSource = source("../app/submit/page.tsx");
const submitFormSource = source("../components/submit-request-form.tsx");
const manageWorkspaceSource = source("../app/w/[workspaceSlug]/page.tsx");

const startDemoActionSource = functionSource(actionsSource, "startDemoAction");
const existingSessionSource = functionSource(actionsSource, "existingSessionDestination");

describe("demo entry point", () => {
  // A GET link would be followed by crawlers, link prefetchers, and preview bots, each
  // one minting a workspace and burning a slot of the per-IP budget. The POST is also
  // what makes the same-origin check meaningful.
  it("posts to a server action instead of linking to a demo url", () => {
    expect(buttonSource).toContain("useActionState(startDemoAction");
    expect(buttonSource).toContain("<form action={startDemo}");
    expect(buttonSource).toContain('type="submit"');
    expect(codeOnly(buttonSource)).not.toContain("href=");
  });

  it("same-origin checks the request before anything is written", () => {
    const checked = startDemoActionSource.indexOf("requireTrustedActionRequest()");
    const written = startDemoActionSource.indexOf("startDemoSession()");
    expect(checked).toBeGreaterThan(-1);
    expect(checked).toBeLessThan(written);
  });

  // A double submit, a stale tab, or a back-button replay must not leave a stranded
  // workspace behind and eat another of the three creations this IP gets per hour.
  it("reuses a live session instead of minting a second workspace", () => {
    const reused = startDemoActionSource.indexOf("existingSessionDestination()");
    const minted = startDemoActionSource.indexOf("startDemoSession()");
    expect(reused).toBeGreaterThan(-1);
    expect(reused).toBeLessThan(minted);
  });

  // getCurrentUser() always prefers Clerk over the demo cookie, so a workspace minted
  // for a signed-in user would be one they could never open.
  it("sends a signed-in user to their own workspace rather than minting a demo", () => {
    expect(existingSessionSource).toContain("isDemoUser(user)");
    expect(existingSessionSource).toContain("getActiveWorkspaceAccess(user.id)");
    expect(existingSessionSource).toContain("getPostAuthWorkspacePath()");
  });

  // The session id comes from the visitor's own signed cookie. Reading a workspace or
  // session out of the submitted form would let anyone name someone else's.
  it("never trusts a client-supplied workspace or session", () => {
    const code = codeOnly(startDemoActionSource);
    expect(code).not.toContain("formData.get");
    expect(code).not.toContain("formText(");
  });

  // This button is public and bots will find it. Reporting every refusal would bury
  // the failures that actually need a human.
  it("keeps rate limits and the kill switch out of the error tracker", () => {
    expect(startDemoActionSource).toContain("error instanceof RateLimitError");
    expect(startDemoActionSource).toContain("error instanceof PublicError");
    const guard = startDemoActionSource.indexOf("instanceof RateLimitError");
    const capture = startDemoActionSource.indexOf("captureOperationalError");
    expect(guard).toBeLessThan(capture);
  });

  // The callers sit in a fixed header and at the foot of a long page; an error banner
  // at the top of the landing page would never be read from either.
  it("returns failures inline rather than redirecting with a query param", () => {
    expect(startDemoActionSource).toContain("return { error: actionErrorMessage(error) }");
    expect(codeOnly(startDemoActionSource)).not.toContain("redirectWithError");
  });

  it("tags its Sentry reports as demo traffic", () => {
    expect(startDemoActionSource).toContain('area: "demo_session_start", demo: true');
  });

  // try-demo-button is a client component. Importing lib/demo would pull node:crypto
  // and next/headers into the browser bundle and break the build.
  it("keeps the server-only demo module out of the client component", () => {
    expect(codeOnly(buttonSource)).not.toContain('from "@/lib/demo"');
  });
});

describe("landing page and header", () => {
  // The demo took the slot Sign in used to hold, so the header links to /login
  // nowhere. The closing CTA is where a returning visitor finds it.
  it("carries no Sign in link in the header", () => {
    expect(occurrences(codeOnly(headerSource), "/login")).toBe(0);
    expect(headerSource).toContain('<TryDemoButton buttonClassName="btn--neutral btn--sm" />');
    expect(codeOnly(landingSource)).toContain('href="/login"');
  });

  it("puts the demo in both the desktop header and the mobile menu", () => {
    expect(occurrences(headerSource, "<TryDemoButton")).toBe(2);
  });

  // The hero is the one place on the page that leads with the demo. The closing CTA
  // goes back to Start now plus Sign in.
  it("gives the hero the demo and the bottom CTA the sign-in link", () => {
    const code = codeOnly(landingSource);
    expect(occurrences(code, "<HeroDemoCta")).toBe(1);
    expect(occurrences(code, "<SignInLink")).toBe(2);
    expect(code).not.toContain("SecondaryLink");
  });

  it("labels the demo the same way everywhere", () => {
    expect(buttonSource).toContain('label = "Live demo"');
    expect(codeOnly(landingSource)).not.toContain("Try live demo");
    expect(codeOnly(headerSource)).not.toContain("Try live demo");
  });

  // Without a signing secret the cookies could not be trusted, so the demo fails
  // closed. The page must not keep advertising a button that can only error.
  // The hero falls back to Sign in; the header simply drops the button, leaving the
  // closing CTA as the way to /login. Either way nothing renders that can only error.
  it("hides the demo everywhere when it is switched off", () => {
    expect(landingSource).toContain("isDemoEnabled()");
    expect(landingSource).toContain("function HeroDemoCta({ demoEnabled }");
    expect(landingSource).toContain("if (!demoEnabled) return <SignInLink");
    expect(headerSource).toContain("{ demoEnabled }: { demoEnabled: boolean }");
    expect(headerSource).toContain("{demoEnabled ? <TryDemoButton");
  });

  // The flag is a boolean derived on the server. Passing the secret itself over the
  // client boundary would hand anyone the ability to mint a session cookie.
  it("never sends the signing secret to the client", () => {
    expect(codeOnly(landingSource)).not.toContain("DEMO_SESSION_SECRET");
    expect(codeOnly(headerSource)).not.toContain("DEMO_SESSION_SECRET");
    expect(codeOnly(buttonSource)).not.toContain("DEMO_SESSION_SECRET");
  });

  // Start now stays the primary CTA in both places; the demo replaced Sign in in the
  // hero, not sign-up.
  it("leaves Start now as the primary call to action", () => {
    expect(occurrences(landingSource, "<StartNowLink")).toBe(2);
    expect(headerSource).toContain('href="/signup?next=/onboarding" className="btn btn--primary btn--sm"');
  });
});

describe("demo attachment lock", () => {
  // submitRequestAction refuses attachments from a demo principal, and both download
  // routes are guarded. Rendering the picker anyway meant the refusal only arrived
  // after the visitor had chosen a file and submitted.
  it("hides the file picker from a demo session instead of failing on submit", () => {
    expect(submitPageSource).toContain("const allowAttachments = !isDemoUser(user);");
    expect(submitPageSource).toContain("allowAttachments={allowAttachments}");
    expect(submitFormSource).toContain("allowAttachments ? (");
    expect(submitFormSource).toContain("<RequestAttachmentsInput />");
  });

  it("still refuses attachments server-side, which is the actual boundary", () => {
    expect(actionsSource).toContain("if (attachments.length > 0) assertRealUser(user);");
  });
});

describe("workspace manage page", () => {
  // A demo slug is `demo-` plus 32 hex characters. Inline at the end of the
  // description it broke the paragraph it sat in.
  it("shows the slug on its own line rather than inside the description", () => {
    expect(manageWorkspaceSource).toContain(
      '<p className="page-sub">Share access, manage invites, and control your membership.</p>'
    );
    expect(manageWorkspaceSource).toContain('<span className="chip mono"');
  });
});

// A project-wide writing rule, enforced here so it cannot drift back in one comment
// at a time.
describe("no em-dashes in the project", () => {
  it("finds none in any tracked source, style, SQL, or docs file", () => {
    // Every spelling, not just the literal character. A first pass of this guard
    // checked only U+2014 and missed four HTML-entity spellings that rendered as an
    // em-dash in the browser. Each pattern is assembled at runtime so the guard
    // cannot match itself, and so it still covers this file.
    const char = String.fromCharCode(0x2014);
    const forms = [char, `&${"mdash"};`, `&#${8212};`, `&#${"x2014"};`, `\\${"u2014"}`];
    const skip = new Set(["node_modules", ".next", ".git", ".codex", "public"]);
    const offenders: string[] = [];

    const walk = (dir: URL, label: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue;
        const path = `${label}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(new URL(`${entry.name}/`, dir), path);
          continue;
        }
        if (!/\.(ts|tsx|css|sql|md|example)$/.test(entry.name)) continue;
        const src = readFileSync(new URL(entry.name, dir), "utf8");
        for (const form of forms) {
          if (src.includes(form)) offenders.push(`${path} (${form === char ? "literal" : form})`);
        }
      }
    };

    walk(new URL("../", import.meta.url), ".");
    expect(offenders).toEqual([]);
  });
});

describe("expired demo screen", () => {
  it("offers a fresh demo, sign-up, and a way out", () => {
    expect(expiredPageSource).toContain('label="Start a fresh demo"');
    expect(expiredPageSource).toContain("DEMO_SIGNUP_HREF");
    expect(expiredPageSource).toContain("endDemoSessionAction");
  });
});

// The vision's first security requirement, verified at the final gate: a demo
// principal must not reach any workspace but its own. RLS is not the boundary here:
// every server path uses the service-role client, so requireWorkspaceMembership is
// the isolation check, and it is worth testing against a real call rather than by
// reading the source.
describe("demo workspace isolation", () => {
  it("refuses a workspace the caller is not a member of", async () => {
    const { filters } = stubMembershipClient(null);
    const { requireWorkspaceMembership } = await import("./workspaces");

    await expect(requireWorkspaceMembership("someone-elses-workspace", "demo-profile-1")).rejects.toThrow(
      "Workspace access is required."
    );
    // Both halves matter: the membership row must belong to this caller AND to the
    // workspace being opened. Dropping either filter would hand over someone else's.
    expect(filters).toEqual([
      ["user_id", "demo-profile-1"],
      ["workspaces.slug", "someone-elses-workspace"],
    ]);
  });

  it("resolves the demo visitor's own workspace with the role the membership carries", async () => {
    stubMembershipClient({ role: "owner", workspaces: { id: "ws-demo-1", slug: "demo-abc", is_demo: true } });
    const { requireWorkspaceMembership } = await import("./workspaces");

    const access = await requireWorkspaceMembership("demo-abc", "demo-profile-2");
    expect(access.workspace.slug).toBe("demo-abc");
    expect(access.workspace.isDemo).toBe(true);
    expect(access.membership.role).toBe("owner");
  });
});

describe("demo routes stay out of search", () => {
  it("lists no demo or workspace url in the sitemap", () => {
    const code = codeOnly(sitemapSource);
    expect(code).not.toContain("/demo");
    expect(code).not.toContain("/w/");
  });
});
