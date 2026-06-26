import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock, FileText, MapPin, MessageSquare, User } from "lucide-react";
import { TicketUpdateForm } from "@/components/ticket-update-form";
import { requireWorkspaceContext } from "@/lib/auth";
import { getTicketDetail, listDepartments } from "@/lib/store";
import { ticketStatusBadgeClass } from "@/lib/ticket-status";
import { cn } from "@/lib/utils";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";
import { isWorkspacePreview } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function TicketDetailView({ params, workspaceSlug }: { params: Promise<{ id: string }>; workspaceSlug?: string }) {
  const { user, workspace, membership } = await requireWorkspaceContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const isPreview = isWorkspacePreview(workspace.id);
  const isAdmin = isPreview || membership.role === "admin" || membership.role === "owner";
  const { id } = await params;
  const detail = await getTicketDetail(id, isAdmin ? undefined : user.id, workspace.id);
  const departments = await listDepartments(workspace.id);

  if (!detail) {
    notFound();
  }

  const { ticket, activity, notes, similarTickets } = detail;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between mb-6">
        <Link href={href("/tickets")} className="text-sm font-medium text-muted hover:text-fg flex items-center gap-2 transition-colors">
          <ArrowLeft size={16} /> Back to Tickets
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <div className="bg-surface rounded-[var(--radius-card)] p-8 border border-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono font-medium text-muted">{ticket.id}</span>
              <span className={cn("border text-[10px] px-2 py-1 uppercase tracking-wider font-medium rounded-md", ticketStatusBadgeClass(ticket.status))}>
                {ticket.status}
              </span>
              <span className="text-[10px] px-2 py-1 uppercase tracking-wider font-medium rounded-md bg-surface-hover text-muted">
                {ticket.priority} Priority
              </span>
            </div>

            <h1 className="text-2xl font-semibold text-fg mb-6">{ticket.title}</h1>

            <div className="text-sm text-fg mb-8 p-4 bg-bg border border-border rounded-[var(--radius-control)]">
              {ticket.description}
            </div>

            <div className="mb-8 p-5 bg-bg text-fg rounded-[var(--radius-card)] flex flex-col gap-3 border border-border">
              <h3 className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-muted flex items-center gap-2">
                <FileText size={14} /> AI Triage Summary
              </h3>
              <p className="text-sm font-medium leading-relaxed">{ticket.triageSummary}</p>
              <p className="text-xs text-muted">{ticket.priorityReasoning}</p>
            </div>

            {isAdmin ? (
              <TicketUpdateForm
                workspaceSlug={workspaceSlug}
                ticketId={ticket.id}
                isPreview={isPreview}
                status={ticket.status}
                department={ticket.department}
                resolutionNotes={ticket.resolutionNotes}
                departments={departments}
              />
            ) : null}
          </div>

          {isAdmin ? (
          <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border">
            <h3 className="font-medium text-fg mb-5 flex items-center gap-2">
              <MessageSquare size={18} className="text-muted" /> Internal Notes
            </h3>
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-muted">No internal notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-bg border border-border rounded-[var(--radius-control)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-fg">{note.actor}</span>
                      <span className="font-mono text-[10px] text-faint">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-fg leading-relaxed">{note.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          ) : null}
        </div>

        <div className="col-span-1 space-y-6">
          {isAdmin ? (
          <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border">
            <h3 className="font-medium text-fg mb-6">Details</h3>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted mt-0.5" />
                <div>
                  <div className="text-xs text-muted font-medium">Location</div>
                  <div className="text-fg mt-0.5">{ticket.location}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User size={16} className="text-muted mt-0.5" />
                <div>
                  <div className="text-xs text-muted font-medium">Contact</div>
                  <div className="text-fg mt-0.5">{ticket.contactName || "Anonymous"}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 size={16} className="text-muted mt-0.5" />
                <div>
                  <div className="text-xs text-muted font-medium">Department</div>
                  <div className="text-fg mt-0.5 uppercase tracking-wider">{ticket.department}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-muted mt-0.5" />
                <div>
                  <div className="text-xs text-muted font-medium">Created</div>
                  <div className="text-fg mt-0.5">{new Date(ticket.createdAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
          ) : null}

          <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border">
            <h3 className="font-medium text-fg mb-6">Similar Tickets</h3>
            <div className="space-y-3">
              {similarTickets.length === 0 ? (
                <p className="text-sm text-muted">No close matches found.</p>
              ) : (
                similarTickets.map((similar) => (
                  <Link key={similar.id} href={href(`/tickets/${similar.id}`)} className="block bg-bg border border-border p-3 rounded-[var(--radius-control)] hover:border-border-strong transition-colors">
                    <div className="text-sm font-medium text-fg">{similar.title}</div>
                    <div className="text-xs text-muted mt-1">{similar.id} &middot; {similar.reason}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border">
            <h3 className="font-medium text-fg mb-6">Activity History</h3>

            <div className="relative border-l border-border ml-3 space-y-6 pb-2">
              {activity.map((act, i) => (
                <div key={act.id} className="pl-6 relative">
                  <div className={cn("absolute w-3 h-3 rounded-full -left-[6.5px] top-1 ring-4 ring-surface", i === 0 ? "bg-accent" : "bg-border-strong")} />
                  <div className="text-sm font-medium text-fg">{act.action}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {act.actor} &middot; {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-xs text-muted mt-1">{act.details}</div>
                </div>
              ))}
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
