import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock, FileText, LockKeyhole, MapPin, MessageSquare, User } from "lucide-react";
import { updateTicketAction } from "@/app/actions";
import { requireWorkspaceContext } from "@/lib/auth";
import { getTicketDetail, listDepartments } from "@/lib/store";
import { ticketStatuses } from "@/lib/schema";
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
            <form action={updateTicketAction} className="mt-8 pt-8 border-t border-border space-y-5">
              {isPreview ? (
                <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
                  <LockKeyhole size={15} className="mt-0.5 shrink-0" />
                  <p><span className="font-semibold">Preview locked.</span> Ticket update controls are visible for evaluation, but changes cannot be saved.</p>
                </div>
              ) : null}
              <fieldset disabled={isPreview} className="space-y-5 disabled:opacity-60">
              {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
              <input type="hidden" name="ticketId" value={ticket.id} />
              <h3 className="text-base font-medium mb-2 flex items-center gap-2 text-fg">
                <MessageSquare size={18} className="text-muted" /> Update Ticket
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="status" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Status</label>
                  <select id="status" name="status" defaultValue={ticket.status} className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border">
                    {ticketStatuses.map((status) => (
                      <option key={status} value={status}>{status.replace("-", " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="department" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Department</label>
                  <select id="department" name="department" defaultValue={ticket.department} className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm text-fg focus:outline-none focus:border-accent-border">
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="resolutionNotes" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Resolution Notes</label>
                <textarea id="resolutionNotes" name="resolutionNotes" defaultValue={ticket.resolutionNotes} rows={3} className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-4 text-sm text-fg focus:outline-none focus:border-accent-border resize-none" />
              </div>

              <div className="space-y-2">
                <label htmlFor="note" className="font-mono text-xs font-medium text-muted uppercase tracking-[0.1em]">Internal Note</label>
                <textarea id="note" name="note" rows={2} placeholder="Add a note or update..." className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-4 text-sm text-fg focus:outline-none focus:border-accent-border resize-none placeholder:text-faint" />
              </div>

              <div className="flex justify-end">
                <button className="bg-accent text-accent-fg px-5 py-2.5 rounded-[var(--radius-control)] text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                  {isPreview ? <><LockKeyhole size={15} /> Preview locked</> : "Save Update"}
                </button>
              </div>
              </fieldset>
            </form>
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
