import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Building2, ChevronRight, Clock, FileText, MapPin, Paperclip, RefreshCw, Sparkles, User, UserCheck } from "lucide-react";
import { AttachmentFileName } from "@/components/attachment-file-name";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { TicketUpdateForm } from "@/components/ticket-update-form";
import { getUserProfile, requireWorkspaceContext } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { Priority } from "@/lib/schema";
import { getTicketDetail, listDepartments } from "@/lib/store";
import { ticketStatusBadgeClass } from "@/lib/ticket-status";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { listTicketAssignees } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

const PRIORITY_HUE: Record<Priority, string> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

function Meta({ label, value, icon: Icon }: { label: string; value: string; icon: typeof MapPin }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
      <div className="cluster" style={{ gap: 7, alignItems: "flex-start" }}>
        <Icon size={14} className="faint" style={{ marginTop: 3 }} />
        <span style={{ minWidth: 0, overflowWrap: "anywhere", fontWeight: 550, fontSize: 13.5 }}>{value}</span>
      </div>
    </div>
  );
}

export async function TicketDetailView({ params, workspaceSlug }: { params: Promise<{ id: string }>; workspaceSlug?: string }) {
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const { id } = await params;
  const [detail, departments, assignees] = await Promise.all([
    getTicketDetail(id, isAdmin ? undefined : user.id, workspace.id),
    listDepartments(workspace.id),
    listTicketAssignees(workspace.id, user.id),
  ]);

  if (!detail) {
    notFound();
  }

  const { ticket, aiPriority, summaryEdited, activity, notes, attachments, similarTickets } = detail;
  const requester = ticket.requesterUserId ? await getUserProfile(ticket.requesterUserId) : undefined;
  const requesterName = requester?.displayName || ticket.contactName || "Anonymous";
  // An assignee who has since left or been demoted is not in the list, so the ticket
  // reads as unassigned and the next save clears it.
  const assignee = assignees.find((member) => member.id === ticket.assigneeUserId);
  const departmentName = departments.find((department) => department.id === ticket.department)?.name ?? ticket.department;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <div className="between wrap" style={{ gap: 14, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="cluster wrap" style={{ gap: 10 }}>
            <span className="mono faint" style={{ fontSize: 12 }}>{ticket.id}</span>
            <span className={cn("border text-[10px] px-2 py-1 uppercase tracking-wider font-medium rounded-md", ticketStatusBadgeClass(ticket.status))}>
              {ticket.status.replace("-", " ")}
            </span>
            <span className="badge" data-hue={PRIORITY_HUE[ticket.priority]}>{ticket.priority} priority</span>
          </div>
          <h1 className="page-title" style={{ marginTop: 10 }}>{ticket.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* LEFT */}
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="card">
            <div className="panel-head">
              <div className="section-title">Details</div>
              {ticket.requestId ? <span className="eyebrow">From request</span> : null}
            </div>
            <div className="card-pad">
              <p style={{ lineHeight: 1.6, fontSize: 14 }}>{ticket.description}</p>

              <div className="grid cols-2" style={{ gap: 14, marginTop: 18 }}>
                <Meta label="Department" value={departmentName} icon={Building2} />
                <Meta label="Assignee" value={assignee?.name ?? "Unassigned"} icon={UserCheck} />
                <Meta label="Location" value={ticket.location || "-"} icon={MapPin} />
                <Meta label="Requester" value={requesterName} icon={User} />
                <Meta label="Contact" value={ticket.contactName || "Anonymous"} icon={User} />
                <Meta label="Opened" value={formatDateTime(ticket.createdAt)} icon={Clock} />
                <Meta label="Updated" value={relativeTime(ticket.updatedAt)} icon={RefreshCw} />
              </div>

              {attachments.length > 0 ? (
                <div style={{ marginTop: 18 }}>
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

              <div className="callout callout--accent" style={{ marginTop: 18 }}>
                <div className="between wrap" style={{ gap: 8 }}>
                  <div className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={12} /> AI triage summary
                  </div>
                  {summaryEdited ? <span className="badge" data-hue="neutral">Edited by admin</span> : null}
                </div>
                <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55 }}>{ticket.triageSummary}</p>
                <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>{ticket.priorityReasoning}</p>
                {aiPriority && aiPriority !== ticket.priority ? (
                  <p className="faint" style={{ marginTop: 6, fontSize: 12 }}>
                    AI suggested {aiPriority} priority. This ticket is now {ticket.priority}, so the reasoning above describes the original suggestion.
                  </p>
                ) : null}
                <ConfidenceMeter seed={`${ticket.id}:${ticket.department}`} similarCount={similarTickets.length} className="mt-4" />
              </div>

              {ticket.resolutionNotes ? (
                <div className="callout" style={{ marginTop: 16 }}>
                  <div className="label">Resolution notes</div>
                  <p style={{ marginTop: 6, fontSize: 13.5 }}>{ticket.resolutionNotes}</p>
                </div>
              ) : null}
            </div>
          </div>

          {isAdmin ? (
            <div className="card">
              <div className="panel-head">
                <div className="section-title">Internal notes</div>
                <span className="eyebrow">{notes.length} note{notes.length === 1 ? "" : "s"}</span>
              </div>
              <div className="card-pad stack" style={{ gap: 14 }}>
                {notes.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>No internal notes yet.</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="cluster" style={{ gap: 11, alignItems: "flex-start" }}>
                      <span className="avatar sm">{note.actor.slice(0, 2).toUpperCase()}</span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="cluster" style={{ gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{note.actor}</span>
                          <span className="faint" style={{ fontSize: 11.5 }}>{relativeTime(note.createdAt)}</span>
                        </div>
                        <p style={{ fontSize: 13.5, marginTop: 2, lineHeight: 1.55 }}>{note.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="card">
            <div className="panel-head">
              <div className="section-title">Similar tickets</div>
              <span className="eyebrow">Same department</span>
            </div>
            {similarTickets.length === 0 ? (
              <div className="card-pad"><p className="muted" style={{ fontSize: 13 }}>No close matches found.</p></div>
            ) : (
              <div className="list">
                {similarTickets.map((similar) => (
                  <Link key={similar.id} href={href(`/tickets/${similar.id}`)} className="row-link">
                    <div className="between">
                      <div className="cluster" style={{ gap: 10, minWidth: 0 }}>
                        <span className="mono faint" style={{ fontSize: 11.5 }}>{similar.id}</span>
                        <span style={{ fontWeight: 550, fontSize: 13.5 }}>{similar.title}</span>
                      </div>
                      <ChevronRight size={16} className="faint" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-1 space-y-6">
          {isAdmin ? (
            <div className="card card-pad">
              <TicketUpdateForm
                workspaceSlug={workspaceSlug}
                ticketId={ticket.id}
                status={ticket.status}
                priority={ticket.priority}
                department={ticket.department}
                assigneeUserId={assignee?.id ?? ""}
                resolutionNotes={ticket.resolutionNotes}
                departments={departments}
                assignees={assignees}
              />
            </div>
          ) : null}

          <div className="card">
            <div className="panel-head">
              <div className="section-title">Activity history</div>
              <Activity size={16} className="faint" />
            </div>
            <div className="card-pad" style={{ paddingTop: 10, paddingBottom: 10 }}>
              <div className="feed">
                {activity.map((act) => (
                  <div key={act.id} className="feed-item">
                    <div className="feed-rail">
                      <span className="feed-dot" style={{ borderColor: "var(--accent)" }} />
                      <span className="feed-line" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 550 }}>{act.action}</div>
                      <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {act.actor} · {relativeTime(act.createdAt)}
                      </div>
                      {act.details ? <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{act.details}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  return <TicketDetailView params={params} />;
}
