import Link from "next/link";
import { ArrowRight, LayoutGrid, Link2, Plus, SlidersHorizontal } from "lucide-react";
import { createWorkspaceAction, joinWorkspaceAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { WorkspaceOpenLink } from "@/components/workspace-open-link";
import { getActiveWorkspaceAccess, requireUser } from "@/lib/auth";
import { countOwnedWorkspaces, DEMO_WORKSPACE_INVITE_CODE, isWorkspacePreview, listUserWorkspaces, MAX_WORKSPACES_PER_USER } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const ROLE_HUE: Record<string, string> = {
  owner: "active",
  admin: "info",
  requester: "neutral",
};

function glyph(name: string) {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "WS";
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  // These three are independent, and this page is the post-sign-in landing spot, so
  // running them together removes two serial round trips from the first authenticated
  // render (the slowest one, since it also seeds the profile).
  const [workspaces, ownedCount, activeWorkspace, params] = await Promise.all([
    listUserWorkspaces(user.id),
    countOwnedWorkspaces(user.id),
    getActiveWorkspaceAccess(user.id),
    searchParams,
  ]);
  const atWorkspaceLimit = ownedCount >= MAX_WORKSPACES_PER_USER;
  const activeWorkspaceIsPreview = activeWorkspace ? isWorkspacePreview(activeWorkspace.workspace.id) : false;

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <div className="page-head">
        <div className="eyebrow">Workspace hub</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Your workspaces
        </h1>
        <p className="page-sub">Switch between teams, spin up a new workspace, or join one with an invite.</p>
      </div>

      {params.error ? (
        <div className="st-danger rounded-[var(--radius-card)] border px-4 py-3 text-sm" style={{ marginBottom: 18 }}>
          {params.error}
        </div>
      ) : null}

      {activeWorkspace ? (
        <div className="card" style={{ overflow: "hidden", marginBottom: 22 }}>
          <div
            style={{
              padding: 20,
              background: "radial-gradient(500px 300px at 90% -20%, var(--accent-soft), transparent 60%), var(--surface)",
            }}
          >
            <div className="eyebrow">Currently open</div>
            <div className="between wrap" style={{ gap: 14, marginTop: 12 }}>
              <div className="cluster" style={{ gap: 14, minWidth: 0 }}>
                <span className="ws-pill-glyph" style={{ width: 46, height: 46, fontSize: 17, borderRadius: 12 }}>
                  {glyph(activeWorkspace.workspace.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="cluster wrap" style={{ gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 19 }}>{activeWorkspace.workspace.name}</span>
                    {activeWorkspaceIsPreview ? (
                      <span className="badge" data-hue="warn">
                        Read-only
                      </span>
                    ) : (
                      <span className="badge" data-hue={ROLE_HUE[activeWorkspace.membership.role] ?? "neutral"}>
                        {activeWorkspace.membership.role}
                      </span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 13.5, marginTop: 3 }}>
                    Requests, tickets, and settings are scoped to this workspace.
                  </div>
                </div>
              </div>
              <div className="cluster" style={{ gap: 10 }}>
                <Link href={`/w/${activeWorkspace.workspace.slug}/activate`} className="btn btn--neutral">
                  <LayoutGrid size={15} /> Open dashboard
                </Link>
                <Link href={`/w/${activeWorkspace.workspace.slug}`} className="btn btn--primary">
                  <SlidersHorizontal size={15} /> Manage
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="split" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="stack" style={{ gap: 14 }}>
          <div className="eyebrow">All your workspaces · {workspaces.length}</div>
          {workspaces.length === 0 ? (
            <div className="banner">Create or join a workspace before using requests, tickets, review, and settings.</div>
          ) : (
            workspaces.map(({ workspace, membership }) => {
              const isActive = activeWorkspace?.workspace.id === workspace.id;
              const isPreview = isWorkspacePreview(workspace.id);
              return (
                <WorkspaceOpenLink
                  key={workspace.id}
                  name={workspace.name}
                  slug={workspace.slug}
                  role={membership.role}
                  isActive={isActive}
                  isPreview={isPreview}
                />
              );
            })
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="between" style={{ gap: 10, marginBottom: 12 }}>
              <div className="cluster" style={{ gap: 10 }}>
                <span className="metric-icon">
                  <Plus size={17} />
                </span>
                <div className="section-title">Create a workspace</div>
              </div>
              <span className="badge mono" data-hue={atWorkspaceLimit ? "warn" : "neutral"} title="Workspaces you own vs. your limit">
                {ownedCount}/{MAX_WORKSPACES_PER_USER}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {atWorkspaceLimit
                ? `You have reached the limit of ${MAX_WORKSPACES_PER_USER} workspaces. Delete one to create another.`
                : "Start fresh. You will be the owner with the default departments."}
            </p>
            <form action={createWorkspaceAction}>
              <div className="field">
                <label htmlFor="name" className="label">
                  Workspace name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="e.g. Westside Facilities"
                  className="input"
                  disabled={atWorkspaceLimit}
                />
              </div>
              <SubmitButton pendingText="Creating workspace..." className="btn--sm btn--block" style={{ marginTop: 12 }} disabled={atWorkspaceLimit}>
                <Plus size={14} /> Create workspace
              </SubmitButton>
            </form>
          </div>

          <div className="card card-pad">
            <div className="cluster" style={{ gap: 10, marginBottom: 12 }}>
              <span className="metric-icon">
                <Link2 size={17} />
              </span>
              <div className="section-title">Join with invite</div>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Paste an invite code or link a teammate shared with you.
            </p>
            <form action={joinWorkspaceAction}>
              <div className="field">
                <label htmlFor="code" className="label">
                  Invite code or link
                </label>
                <input id="code" name="code" required minLength={6} maxLength={500} placeholder={DEMO_WORKSPACE_INVITE_CODE} className="input mono" />
                <span className="field-hint">Try the active invite code from the demo workspace.</span>
              </div>
              <SubmitButton pendingText="Joining workspace..." className="btn--neutral btn--sm btn--block" style={{ marginTop: 12 }}>
                <ArrowRight size={14} /> Join workspace
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
