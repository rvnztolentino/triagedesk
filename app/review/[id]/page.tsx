import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, Clock, FileText, Inbox, MapPin, Paperclip, Sparkles, Ticket, User } from "lucide-react";
import { AttachmentFileName } from "@/components/attachment-file-name";
import { CharLimitedTextarea } from "@/components/char-limited-textarea";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { ReviewDecisionForm } from "@/components/review-decision-form";
import { getUserProfile, requireWorkspaceAdminContext } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { RequestStatus } from "@/lib/schema";
import { getRequestBundle, listDepartments } from "@/lib/store";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const STATUS_HUE: Record<RequestStatus, string> = {
  "needs-review": "warn",
  approved: "done",
  rejected: "danger",
  duplicate: "neutral",
};

function Meta({ label, value, icon: Icon }: { label: string; value: string; icon: typeof MapPin }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
      <div className="cluster" style={{ gap: 7 }}>
        <Icon size={14} className="faint" />
        <span style={{ fontWeight: 550, fontSize: 13.5 }}>{value}</span>
      </div>
    </div>
  );
}

export async function ReviewDetailView({ params, workspaceSlug }: { params: Promise<{ id: string }>; workspaceSlug?: string }) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const { id } = await params;
  const bundle = await getRequestBundle(id, undefined, workspace.id);
  const departments = await listDepartments(workspace.id);
  const isPreview = isWorkspacePreview(workspace.id);

  if (!bundle) {
    notFound();
  }

  const { request, triage, similarTickets, attachments } = bundle;
  const approveFormId = `approve-${request.id}`;
  const decided = request.status !== "needs-review";
  const requester = request.requesterUserId ? await getUserProfile(request.requesterUserId) : undefined;
  const submittedBy = requester?.displayName || request.contactName || "Anonymous";
  const statusLabel = request.status.replace("-", " ");

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <Link href={href("/review")} className="btn btn--ghost btn--sm w-fit">
        <ChevronLeft size={15} /> Review queue
      </Link>

      <div className="between wrap" style={{ gap: 14, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">Review · {request.id}</span>
          <h1 className="page-title" style={{ marginTop: 8 }}>{triage.title}</h1>
        </div>
        <span className="badge" data-hue={STATUS_HUE[request.status]}><span className="dot" /> {statusLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* LEFT: raw submission + similar */}
        <div className="col-span-1 space-y-6">
          <div className="card">
            <div className="panel-head">
              <div className="section-title">Raw submission</div>
              <Inbox size={16} className="faint" />
            </div>
            <div className="card-pad">
              <p style={{ lineHeight: 1.6, fontSize: 14 }}>{request.description}</p>
              <div className="grid cols-2" style={{ gap: 14, marginTop: 18 }}>
                <Meta label="Location" value={request.location || "-"} icon={MapPin} />
                <Meta label="Contact" value={request.contactName || "Anonymous"} icon={User} />
                <Meta label="Submitted by" value={submittedBy} icon={User} />
                <Meta label="When" value={relativeTime(request.createdAt)} icon={Clock} />
              </div>

              {request.urgencyNote ? (
                <div className="callout" style={{ marginTop: 16 }}>
                  <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={12} /> Urgency note
                  </div>
                  <p style={{ marginTop: 6, fontSize: 13.5 }}>{request.urgencyNote}</p>
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <div className="label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Paperclip size={12} /> Attachments
                  </div>
                  <div className="cluster wrap" style={{ gap: 8 }}>
                    {attachments.map((attachment) => (
                      <a key={attachment.id} href={href(`/attachments/${attachment.id}`)} className="chip">
                        <FileText size={13} /> <AttachmentFileName fileName={attachment.fileName} />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {request.status === "duplicate" && request.duplicateOfTicketId ? (
                <div className="callout" style={{ marginTop: 16, fontSize: 13.5 }}>
                  Duplicate · linked to {request.duplicateOfTicketId}
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="panel-head">
              <div className="section-title">Similar tickets</div>
              <span className="eyebrow">{similarTickets.length} match{similarTickets.length === 1 ? "" : "es"}</span>
            </div>
            {similarTickets.length === 0 ? (
              <div className="card-pad"><p className="muted" style={{ fontSize: 13 }}>No close matches found.</p></div>
            ) : (
              <div className="list">
                {similarTickets.map((ticket) => (
                  <Link key={ticket.id} href={href(`/tickets/${ticket.id}`)} className="row-link">
                    <div className="between">
                      <div style={{ minWidth: 0 }}>
                        <span className="mono faint" style={{ fontSize: 11.5 }}>{ticket.id}</span>
                        <div style={{ fontWeight: 550, marginTop: 4, fontSize: 13.5 }}>{ticket.title}</div>
                      </div>
                      <ChevronRight size={16} className="faint" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: triage output + decision */}
        <div className="col-span-1 md:col-span-2">
          <ReviewDecisionForm formId={approveFormId} isPreview={isPreview} decided={decided}>
            {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
            <input type="hidden" name="requestId" value={request.id} />

            <div className="card">
              <div className="panel-head">
                <div className="cluster" style={{ gap: 8 }}>
                  <div className="section-title">Triage output</div>
                  <span className="badge" data-hue="accent"><Sparkles size={11} /> AI</span>
                </div>
              </div>
              <div className="card-pad stack" style={{ gap: 16 }}>
                <ConfidenceMeter seed={`${request.id}:${triage.department}`} similarCount={similarTickets.length} />

                <div className="field">
                  <label htmlFor="title" className="label">Suggested title</label>
                  <input id="title" name="title" type="text" maxLength={160} defaultValue={triage.title} className="input" />
                </div>

                <div className="grid cols-2" style={{ gap: 12 }}>
                  <div className="field">
                    <label htmlFor="priority" className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={12} /> Priority
                    </label>
                    <select id="priority" name="priority" defaultValue={triage.priority} className="select">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="department" className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Building2 size={12} /> Department
                    </label>
                    <select id="department" name="department" defaultValue={triage.department} className="select">
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label className="label">AI reasoning</label>
                  <div className="ai-reason">{triage.priorityReasoning}</div>
                </div>

                <div className="field">
                  <label htmlFor="summary" className="label">Edited summary</label>
                  <CharLimitedTextarea id="summary" name="summary" defaultValue={triage.summary} max={1200} rows={4} className="textarea" />
                </div>
              </div>
            </div>
          </ReviewDecisionForm>

          {decided ? (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="cluster" style={{ gap: 10 }}>
                <span className="badge" data-hue={STATUS_HUE[request.status]}><span className="dot" /> {statusLabel}</span>
                {request.reviewedAt ? <span className="muted" style={{ fontSize: 13 }}>{formatDateTime(request.reviewedAt)}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  return <ReviewDetailView params={params} />;
}
