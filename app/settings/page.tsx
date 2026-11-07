import { Lock, SunMoon, Trash2 } from "lucide-react";
import { deleteWorkspaceDepartmentAction } from "@/app/actions";
import { AddDepartmentPopover } from "@/components/add-department-popover";
import { requireWorkspaceContext } from "@/lib/auth";
import { listDepartments } from "@/lib/store";
import { getRuntimeSetupStatus } from "@/lib/supabase";
import { defaultDepartmentIds } from "@/lib/schema";
import { MAX_CUSTOM_WORKSPACE_DEPARTMENTS } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function SettingsPageView({ searchParams, workspaceSlug }: { searchParams: Promise<{ error?: string }>; workspaceSlug?: string }) {
  const { membership, workspace } = await requireWorkspaceContext(workspaceSlug);
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  const params = await searchParams;

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-[720px] space-y-5">
        <div className="page-head">
          <div className="eyebrow">Settings</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Appearance
          </h1>
          <p className="page-sub">Only admins can manage system settings and departments.</p>
        </div>
        <div className="card card-pad">
          <div className="cluster" style={{ gap: 12 }}>
            <span className="metric-icon">
              <SunMoon size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>Customize your view</div>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
                The theme follows your system setting by default. Use the theme switch at the bottom of the sidebar to override it; your choice is saved on this device.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const setup = getRuntimeSetupStatus();
  const departments = await listDepartments(workspace.id);
  const customDepartmentCount = departments.filter((d) => !(defaultDepartmentIds as readonly string[]).includes(d.id)).length;
  const departmentsAtLimit = customDepartmentCount >= MAX_CUSTOM_WORKSPACE_DEPARTMENTS;
  const allUp = setup.supabaseConfigured && setup.groqConfigured;
  const healthRows = [
    { label: "Database", hue: setup.supabaseConfigured ? "done" : "warn", value: setup.supabaseConfigured ? "Configured" : "Missing setup" },
    { label: "AI triage", hue: setup.groqConfigured ? "done" : "warn", value: setup.groqConfigured ? "Configured" : "Missing setup" },
    { label: "Attachment bucket", hue: "done", value: setup.storageBucket },
  ] as const;
  const policies = [
    { label: "Workspace entry", value: "Invite only" },
    { label: "Assigned role", value: "From invite" },
    { label: "Invite creation", value: membership.role === "owner" ? "Requester or admin" : "Requester only" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5">
      <div className="page-head">
        <div className="eyebrow">Settings</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Workspace settings
        </h1>
        <p className="page-sub">System status, access policy, and department routing for {workspace.name}.</p>
      </div>

      {params.error ? (
        <div className="st-danger rounded-[var(--radius-card)] border px-4 py-3 text-sm">{params.error}</div>
      ) : null}

      <div className="split split-even">
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="panel-head">
              <div className="section-title">System health</div>
              <span className="badge" data-hue={allUp ? "done" : "warn"}>
                {allUp ? "All core systems up" : "Action needed"}
              </span>
            </div>
            <div className="stack" style={{ gap: 2, padding: "4px 18px 12px" }}>
              {healthRows.map((row) => (
                <div key={row.label} className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="cluster" style={{ gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${row.hue})` }} />
                    <span style={{ fontWeight: 550, fontSize: 14 }}>{row.label}</span>
                  </div>
                  <span className="badge" data-hue={row.hue}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="panel-head">
              <div className="section-title">Access policy</div>
              <Lock size={16} className="faint" />
            </div>
            <div className="card-pad stack" style={{ gap: 12 }}>
              {policies.map((policy) => (
                <div key={policy.label} className="between">
                  <span style={{ fontSize: 14, fontWeight: 550 }}>{policy.label}</span>
                  <span className="badge" data-hue="neutral">
                    {policy.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stretch-frame">
        <div className="card">
          <div className="panel-head wrap">
            <div className="section-title">Departments</div>
            <div className="cluster wrap" style={{ gap: 10 }}>
              <span className="badge" data-hue={departmentsAtLimit ? "danger" : "neutral"}>
                {customDepartmentCount} / {MAX_CUSTOM_WORKSPACE_DEPARTMENTS} custom
              </span>
              <AddDepartmentPopover workspaceSlug={workspaceSlug} disabled={departmentsAtLimit} />
            </div>
          </div>
          <div className="list">
            {departments.map((department) => {
              const isDefault = (defaultDepartmentIds as readonly string[]).includes(department.id);
              return (
                <div key={department.id} className="row-link" style={{ cursor: "default" }}>
                  <div className="between" style={{ gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="cluster wrap" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{department.name}</span>
                        <span className="mono faint" style={{ fontSize: 11, overflowWrap: "anywhere" }}>
                          {department.id}
                        </span>
                        {isDefault ? (
                          <span className="badge" data-hue="neutral">
                            Default
                          </span>
                        ) : null}
                      </div>
                      {department.description ? (
                        <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                          {department.description}
                        </div>
                      ) : null}
                    </div>
                    {!isDefault ? (
                      <form action={deleteWorkspaceDepartmentAction}>
                        {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
                        <input type="hidden" name="id" value={department.id} />
                        <button className="btn btn--danger btn--sm">
                          <Trash2 size={14} />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <SettingsPageView searchParams={searchParams} />;
}
