import Link from "next/link";
import { Building2, Sparkles } from "lucide-react";
import { requireWorkspaceAdminContext } from "@/lib/auth";
import { listDepartments, listReviewItems } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export const dynamic = "force-dynamic";

const PRIORITY_HUE: Record<string, string> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function ReviewQueueView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const queue = await listReviewItems(workspace.id);
  const departments = await listDepartments(workspace.id);
  const deptNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));
  const setup = getRuntimeSetupStatus();
  const isSetupRequired = setup.missing.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5">
      <div className="page-head">
        <div className="eyebrow">Review queue</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Requests awaiting review
        </h1>
        <p className="page-sub">AI-triaged requests waiting for a human approve / edit / reject decision.</p>
      </div>

      <div className="card">
        <div className="panel-head">
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} className="accent-text" /> Auto-triage pending
          </div>
          <span className="badge" data-hue="warn">
            {queue.length}
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph">
              <Sparkles size={22} />
            </div>
            <div style={{ fontWeight: 600, color: "var(--fg)" }}>{isSetupRequired ? "Setup required" : "No requests waiting"}</div>
            <div style={{ maxWidth: "40ch", fontSize: 13.5 }}>
              {isSetupRequired
                ? "Database and AI triage configuration must be completed."
                : "New submissions will appear here after AI triage."}
            </div>
            <div style={{ marginTop: 6 }}>
              {isSetupRequired ? (
                <Link href="/api/health" className="btn btn--sm">
                  Check health
                </Link>
              ) : (
                <Link href={href("/submit")} className="btn btn--primary btn--sm">
                  Submit a request
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="list">
            {queue.map(({ request, triage }) => (
              <Link key={request.id} href={href(`/review/${request.id}`)} className="row-link">
                <div className="data-row" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                  <span className="badge" data-hue={PRIORITY_HUE[triage.priority] ?? "neutral"}>
                    <span className="dot" /> {triage.priority}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="cluster wrap" style={{ gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{triage.title}</span>
                      <span className="chip" style={{ padding: "2px 8px", fontSize: 11 }}>
                        <Building2 size={11} /> {deptNames[triage.department] ?? capitalize(triage.department)}
                      </span>
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 13, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {request.description}
                    </div>
                    <div className="cluster wrap" style={{ gap: 10, marginTop: 5 }}>
                      <span className="mono faint" style={{ fontSize: 11.5 }}>
                        {new Date(request.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="faint" style={{ fontSize: 11.5 }}>
                        {request.location || "No location"} · {request.contactName || "Anonymous"}
                      </span>
                    </div>
                  </div>
                  <span className="badge hide-sm" data-hue="accent">
                    <Sparkles size={11} /> {triage.category}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ReviewQueue() {
  return <ReviewQueueView />;
}
