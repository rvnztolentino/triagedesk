import Link from "next/link";
import { ArrowRight, Building2, Check, FileText, Plus, Sparkles } from "lucide-react";
import { AttachmentFileName } from "@/components/attachment-file-name";
import { isDemoUser, requireWorkspaceContext } from "@/lib/auth";
import { DEMO_SIGNUP_HREF } from "@/lib/demo-ui";
import type { Priority } from "@/lib/schema";
import { getLatestRequestBundle, getRequestBundle } from "@/lib/store";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export const dynamic = "force-dynamic";

const PRIORITY_HUE: Record<Priority, string> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

export async function SubmitConfirmView({ searchParams, requestId, workspaceSlug }: { searchParams?: Promise<{ id?: string }>; requestId?: string; workspaceSlug?: string }) {
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const params = searchParams ? await searchParams : {};
  const targetRequestId = requestId ?? params.id;
  const result = targetRequestId
    ? await getRequestBundle(targetRequestId, isAdmin ? undefined : user.id, workspace.id)
    : await getLatestRequestBundle(isAdmin ? undefined : user.id, workspace.id);

  if (!result) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="card card-pad" style={{ textAlign: "center", padding: 28 }}>
          <div className="section-title">Request not found</div>
          <Link href={href("/submit")} className="btn btn--sm" style={{ marginTop: 14 }}>Submit a new request</Link>
        </div>
      </div>
    );
  }

  const { request, triage, attachments } = result;

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="card card-pad reveal" style={{ padding: 28, textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            margin: "0 auto 16px",
            display: "grid",
            placeItems: "center",
            background: "var(--done-soft)",
            color: "var(--done)",
            border: "1px solid color-mix(in srgb, var(--done) 30%, transparent)",
          }}
        >
          <Check size={24} strokeWidth={2.2} />
        </div>
        <div className="eyebrow">Request received</div>
        <h1 style={{ fontSize: 21, fontWeight: 650, letterSpacing: "-0.02em", marginTop: 8 }}>Thanks, it&apos;s in the queue</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
          Request <span className="mono">{request.id}</span> was triaged and queued for review.
        </p>

        <div className="card card-pad" style={{ marginTop: 20, textAlign: "left", background: "var(--surface-2)" }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div className="eyebrow">Suggested title</div>
            <span className="badge" data-hue="accent"><Sparkles size={11} /> AI</span>
          </div>
          <div style={{ fontWeight: 650, fontSize: 15.5 }}>{triage.title}</div>
          <div className="cluster wrap" style={{ gap: 8, marginTop: 12 }}>
            <span className="badge" data-hue={PRIORITY_HUE[triage.priority]}><span className="dot" /> {triage.priority}</span>
            <span className="chip"><Building2 size={13} /> {triage.department}</span>
            <span className="chip">{triage.category}</span>
          </div>
          <div className="ai-reason" style={{ marginTop: 12 }}>{triage.priorityReasoning}</div>

          {attachments.length > 0 ? (
            <div className="cluster wrap" style={{ gap: 8, marginTop: 14 }}>
              {attachments.map((attachment) => (
                <a key={attachment.id} href={href(`/attachments/${attachment.id}`)} className="chip">
                  <FileText size={13} /> <AttachmentFileName fileName={attachment.fileName} />
                </a>
              ))}
            </div>
          ) : null}

          {request.status === "duplicate" && request.duplicateOfTicketId ? (
            <div className="callout" style={{ marginTop: 14, fontSize: 13 }}>
              Duplicate · linked to {request.duplicateOfTicketId}
            </div>
          ) : null}
        </div>

        {/* The one moment a demo visitor has seen the product actually work on their
            own words — the highest-intent place in the whole demo to ask. */}
        {isDemoUser(user) ? (
          <div className="callout callout--accent" style={{ marginTop: 18, textAlign: "left" }}>
            <div className="eyebrow">That was real AI triage</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              A live model read what you wrote and chose the title, priority, and department above.
              Create a free account to keep this workspace &mdash; otherwise it deletes itself when
              the demo expires.
            </p>
            <Link href={DEMO_SIGNUP_HREF} className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>
              Create free account <ArrowRight size={14} />
            </Link>
          </div>
        ) : null}

        <div className="cluster" style={{ gap: 10, marginTop: 20, justifyContent: "center" }}>
          <Link href={href("/submit")} className="btn btn--sm">
            <Plus size={14} /> Submit another
          </Link>
          {isAdmin ? (
            <Link href={href(`/review/${request.id}`)} className="btn btn--primary btn--sm">
              Review request <ArrowRight size={14} />
            </Link>
          ) : (
            <Link href={href("/tickets")} className="btn btn--primary btn--sm">
              View my tickets <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function SubmitConfirm({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <SubmitConfirmView searchParams={searchParams} />;
}
