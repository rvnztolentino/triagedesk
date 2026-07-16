import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  Inbox,
  Plus,
  Sparkles,
  Ticket,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { requireWorkspaceAdminContext } from "@/lib/auth";
import { getDashboardData } from "@/lib/store";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

// Priority → status hue (escalation: low → critical).
const PRIORITY_HUE: Record<string, string> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "danger",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setupRequirementLabel(value: string) {
  const labels: Record<string, string> = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "auth publishable key",
    CLERK_SECRET_KEY: "auth secret key",
    NEXT_PUBLIC_SUPABASE_URL: "database URL",
    SUPABASE_SERVICE_ROLE_KEY: "server database key",
    SEED_ADMIN_EMAIL: "seed owner email",
    GROQ_API_KEY: "AI service key",
    "AI_PROVIDER=groq": "AI triage provider",
  };
  return labels[value] ?? value;
}

// Smooth SVG area + line resolution-trend chart (pure, server-rendered).
function TrendChart({ points, labels }: { points: number[]; labels: string[] }) {
  const w = 320;
  const h = 92;
  const pad = 6;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${h - pad} L${xy[0][0]},${h - pad} Z` : "";

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dash-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area ? <path d={area} fill="url(#dash-trend-fill)" /> : null}
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 3.4 : 0} fill="var(--accent)" />
        ))}
      </svg>
      <div className="between" style={{ marginTop: 6 }}>
        {labels.map((l, i) => (
          <span key={i} className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// Segmented horizontal bar for priority distribution.
function StackBar({ segments }: { segments: { value: number; hue: string; label: string }[] }) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)" }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.value}`}
            style={{ width: `${(seg.value / total) * 100}%`, background: `var(--${seg.hue})` }}
          />
        ))}
      </div>
      <div className="cluster wrap" style={{ gap: 14, marginTop: 12 }}>
        {segments.map((seg) => (
          <span key={seg.label} className="cluster" style={{ gap: 6, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${seg.hue})` }} />
            <span className="muted">{seg.label}</span>
            <span className="mono" style={{ fontWeight: 600 }}>
              {seg.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="dist-row">
      <span className="dist-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill app-grow-x" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </span>
      <span className="dist-count">{value}</span>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, badge }: { href: string; icon: LucideIcon; label: string; badge?: number }) {
  return (
    <Link href={href} className="btn btn--block" style={{ justifyContent: "flex-start", gap: 11 }}>
      <Icon size={16} style={{ color: "var(--accent-text)" }} />
      <span className="grow" style={{ textAlign: "left", fontWeight: 550 }}>
        {label}
      </span>
      {badge ? (
        <span className="badge" data-hue="warn">
          {badge}
        </span>
      ) : (
        <ChevronRight size={15} className="faint" />
      )}
    </Link>
  );
}

export async function DashboardView({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const { workspace } = await requireWorkspaceAdminContext(workspaceSlug);
  const href = (path: string) => scopedWorkspaceHref(workspaceSlug, path);
  const data = await getDashboardData(workspace.id);
  const { counts, recentActivity, featuredReview, priorityDistribution, departmentWorkload, resolutionTrend } = data;
  const featured = featuredReview;
  const setupMissing = data.setupRequired ?? [];
  const isSetupRequired = setupMissing.length > 0;
  const setupMissingLabels = setupMissing.map(setupRequirementLabel);
  const departmentMax = Math.max(1, ...departmentWorkload.map((item) => item.count));
  const trendTotal = resolutionTrend.reduce((sum, item) => sum + item.resolved, 0);
  const activeDepartments = departmentWorkload.filter((item) => item.count > 0);

  const metrics = [
    { label: "Pending Triage", value: counts.newRequests, icon: Inbox, hue: "warn", to: "/review" },
    { label: "Open Tickets", value: counts.openTickets, icon: Ticket, hue: "info", to: "/tickets" },
    { label: "High Priority", value: counts.highPriority, icon: AlertTriangle, hue: "danger", to: "/tickets" },
    { label: "SLA Risk", value: counts.slaRisk, icon: Clock, hue: "warn", to: "/tickets" },
    { label: "Aging", value: counts.agingTickets, icon: History, hue: "active", to: "/tickets" },
    { label: "Assigned", value: counts.assigned, icon: UserCheck, hue: "done", to: "/tickets" },
  ] as const;

  const workflow = [
    { icon: Inbox, title: "Pending triage", desc: "Requests awaiting review", value: counts.newRequests },
    { icon: Sparkles, title: "Open tickets", desc: "Approved and in progress", value: counts.openTickets },
    { icon: CheckCircle2, title: "Resolved", desc: "Closed and done", value: counts.resolved },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4">
      <div className="page-head between wrap" style={{ gap: 14 }}>
        <div>
          <div className="eyebrow">Operations overview</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            {workspace.name}
          </h1>
          <p className="page-sub">Everything moving through the desk today, at a glance.</p>
        </div>
        <Link href={href("/submit")} className="btn btn--primary">
          <Plus size={16} /> New request
        </Link>
      </div>

      {isSetupRequired ? (
        <div className="banner" style={{ alignItems: "flex-start" }}>
          <AlertTriangle size={16} className="shrink-0" style={{ marginTop: 2 }} />
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Complete system setup to use TriageDesk</div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              Missing configuration: {setupMissingLabels.join(", ")}. See .claude/setup.md to finish setup.
            </p>
          </div>
          <Link href="/api/health" className="btn btn--sm">
            Check health
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} href={href(m.to)} className="card card-hover metric">
              <div className="metric-top">
                <span className="metric-icon" style={{ background: `var(--${m.hue}-soft)`, color: `var(--${m.hue})` }}>
                  <Icon size={16} />
                </span>
                <ArrowUpRight size={15} className="faint" />
              </div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="card">
        <div className="panel-head">
          <div className="section-title">Workflow</div>
          <span className="eyebrow">Submit → Review → Resolve</span>
        </div>
        <div className="flow">
          {workflow.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="flow-step">
                <div className="between">
                  <span className="flow-num">
                    <Icon size={14} />
                  </span>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                    {step.value}
                  </span>
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{step.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {step.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="split" style={{ alignItems: "stretch" }}>
        <div className="stack" style={{ gap: 16 }}>
          {featured ? (
            <div className="card">
              <div className="panel-head">
                <div className="section-title">Featured triage result</div>
                <span className="badge" data-hue="accent">
                  <Sparkles size={11} /> AI
                </span>
              </div>
              <div className="card-pad">
                <div className="between wrap" style={{ gap: 10 }}>
                  <div style={{ fontWeight: 650, fontSize: 16 }}>{featured.triage.title}</div>
                  <span className="badge" data-hue={PRIORITY_HUE[featured.triage.priority] ?? "neutral"}>
                    <span className="dot" /> {featured.triage.priority}
                  </span>
                </div>
                <div className="cluster wrap" style={{ gap: 8, marginTop: 12 }}>
                  <span className="chip">
                    <Building2 size={13} /> {capitalize(featured.triage.department)}
                  </span>
                  <span className="chip">{featured.triage.category}</span>
                </div>
                <div className="ai-reason" style={{ marginTop: 14 }}>
                  {featured.triage.priorityReasoning}
                </div>
                <Link href={href(`/review/${featured.request.id}`)} className="btn btn--primary btn--sm" style={{ marginTop: 16 }}>
                  Review now <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="card card-pad">
              <div className="empty" style={{ padding: "36px 20px" }}>
                <div className="empty-glyph">
                  <CheckCircle2 size={22} />
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>{isSetupRequired ? "Setup required" : "Queue clear"}</div>
                <div style={{ fontSize: 13 }}>
                  {isSetupRequired ? "Complete configuration before review items appear." : "No requests are waiting for review."}
                </div>
              </div>
            </div>
          )}

          <div className="card card-pad">
            <div className="between" style={{ marginBottom: 16 }}>
              <div className="section-title">Priority distribution</div>
              <span className="eyebrow">Active tickets</span>
            </div>
            <StackBar
              segments={priorityDistribution.map((item) => ({
                value: item.count,
                hue: PRIORITY_HUE[item.priority] ?? "neutral",
                label: capitalize(item.priority),
              }))}
            />
          </div>

          {/* Recent activity fills the rest of the left column (below priority) and
              scrolls internally so it never runs long or leaves a gap. */}
          <div className="card" style={{ display: "flex", flexDirection: "column", flex: "1 1 0", minHeight: 200, overflow: "hidden" }}>
            <div className="panel-head">
              <div className="section-title">Recent activity</div>
              <Activity size={16} className="faint" />
            </div>
            <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 8, flex: "1 1 0", minHeight: 0, overflowY: "auto" }}>
              {recentActivity.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  No activity yet.
                </p>
              ) : (
                <div className="feed">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="feed-item">
                      <div className="feed-rail">
                        <span className="feed-dot" />
                        <span className="feed-line" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5 }}>{item.action}</div>
                        <div className="cluster wrap" style={{ gap: 8, marginTop: 2 }}>
                          <span className="mono" style={{ fontSize: 11, color: "var(--accent-text)" }}>
                            {item.ticketId ?? item.requestId}
                          </span>
                          <span className="faint" style={{ fontSize: 11.5 }}>
                            {item.actor} · {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="between" style={{ marginBottom: 8 }}>
              <div className="section-title">Resolution trend</div>
              <span className="badge" data-hue="done">
                <span className="dot" /> 7 days
              </span>
            </div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
              {trendTotal}
              <span className="muted mono" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                closed
              </span>
            </div>
            <div style={{ marginTop: 12 }}>
              <TrendChart points={resolutionTrend.map((item) => item.resolved)} labels={resolutionTrend.map((item) => item.label)} />
            </div>
          </div>

          <div className="card card-pad">
            <div className="between" style={{ marginBottom: 12 }}>
              <div className="section-title">Department workload</div>
              <span className="eyebrow">Active tickets</span>
            </div>
            {activeDepartments.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                No active tickets.
              </p>
            ) : (
              activeDepartments.map((item) => (
                <HBar key={item.department} label={capitalize(item.department)} value={item.count} max={departmentMax} />
              ))
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 12 }}>
              Quick actions
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <QuickLink href={href("/submit")} icon={Plus} label="Submit a request" />
              <QuickLink href={href("/review")} icon={Inbox} label="Open review queue" badge={counts.newRequests} />
              <QuickLink href={href("/tickets")} icon={Ticket} label="Browse all tickets" />
              <QuickLink href="/onboarding" icon={Building2} label="Manage workspace" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
