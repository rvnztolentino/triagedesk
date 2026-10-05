import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Copy,
  Inbox,
  LogOut,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  XCircle,
} from "lucide-react";
import { clearNotificationsAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireWorkspaceContext } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { listNotifications, markAllNotificationsRead } from "@/lib/notifications";
import type { NotificationType, NotificationView } from "@/lib/schema";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export const dynamic = "force-dynamic";

const NOTIFICATION_PAGE_LIMIT = 60;

const typeIcon: Record<NotificationType, { icon: typeof Bell; hue: string }> = {
  request_submitted: { icon: Inbox, hue: "info" },
  request_approved: { icon: CheckCircle2, hue: "active" },
  request_rejected: { icon: XCircle, hue: "danger" },
  request_duplicate: { icon: Copy, hue: "warn" },
  ticket_status_changed: { icon: Ticket, hue: "info" },
  ticket_assigned: { icon: UserCheck, hue: "active" },
  member_joined: { icon: UserPlus, hue: "active" },
  member_left: { icon: LogOut, hue: "neutral" },
  member_removed: { icon: UserMinus, hue: "danger" },
  member_role_changed: { icon: ShieldCheck, hue: "info" },
};

function NotificationRow({ item, workspaceSlug }: { item: NotificationView; workspaceSlug?: string }) {
  const meta = typeIcon[item.type] ?? { icon: Bell, hue: "neutral" };
  const Icon = meta.icon;
  const href = item.link ? scopedWorkspaceHref(workspaceSlug, item.link) : undefined;

  const inner = (
    <div className={`notif-item${item.read ? "" : " notif-item--unread"}`} style={{ display: "flex", gap: 12, padding: "14px 14px", borderRadius: "var(--radius-control)", alignItems: "flex-start" }}>
      <span className="badge" data-hue={meta.hue} style={{ width: 30, height: 30, padding: 0, justifyContent: "center", borderRadius: 8, flexShrink: 0 }}>
        <Icon size={15} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="cluster wrap" style={{ gap: 8 }}>
          <span style={{ fontWeight: item.read ? 550 : 680, fontSize: 14 }}>{item.title}</span>
          {!item.read ? <span className="badge" data-hue="accent">New</span> : null}
        </div>
        {item.body ? <div className="muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>{item.body}</div> : null}
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>{relativeTime(item.createdAt)}</div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="row-link" style={{ display: "block", padding: 0 }}>
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

export async function NotificationsPageView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { user, workspace } = await requireWorkspaceContext(workspaceSlug);
  const notifications = await listNotifications(user.id, workspace.id, NOTIFICATION_PAGE_LIMIT);
  const unreadCount = notifications.filter((item) => !item.read).length;

  // Visiting the full list counts as viewing everything: persist the read state
  // so the bell badge clears on the next navigation. The snapshot above keeps its
  // unread highlights for this render.
  if (unreadCount > 0) {
    await markAllNotificationsRead(user.id, workspace.id);
  }

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5">
      <div className="page-head">
        <div className="between" style={{ alignItems: "flex-start", gap: 16 }}>
          <div>
            <div className="eyebrow">Activity</div>
            <h1 className="page-title" style={{ marginTop: 8 }}>
              Notifications
            </h1>
            <p className="page-sub">
              Updates about your requests, tickets, and {workspace.name}.
            </p>
          </div>
          {notifications.length > 0 ? (
            <form action={clearNotificationsAction}>
              {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
              <ConfirmSubmitButton
                confirmation="Delete all notifications? This cannot be undone."
                pendingText="Clearing…"
                className="btn btn--danger btn--sm"
              >
                <Trash2 size={14} /> Clear all
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <div className="card list">
        {notifications.length === 0 ? (
          <div className="empty">
            <div className="empty-glyph">
              <Bell size={22} />
            </div>
            <div style={{ fontWeight: 600, color: "var(--fg)" }}>No notifications yet</div>
            <div style={{ fontSize: 13.5 }}>New activity in this workspace will show up here.</div>
          </div>
        ) : (
          notifications.map((item) => <NotificationRow key={item.id} item={item} workspaceSlug={workspaceSlug} />)
        )}
      </div>
    </div>
  );
}

export default async function NotificationsPage() {
  return <NotificationsPageView />;
}
