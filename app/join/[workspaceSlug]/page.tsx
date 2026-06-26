import Link from "next/link";
import { Link2, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { joinWorkspaceAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { workspaceSlugSchema } from "@/lib/schema";
import { getWorkspaceBySlug, getWorkspaceInviteByCode, getWorkspaceMembership, isWorkspaceInviteActive, isWorkspacePreview } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export default async function JoinWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { workspaceSlug: rawWorkspaceSlug } = await params;
  const parsedSlug = workspaceSlugSchema.safeParse(rawWorkspaceSlug);
  if (!parsedSlug.success) notFound();

  const workspaceSlug = parsedSlug.data;
  const query = await searchParams;
  const code = query.code?.trim() ?? "";
  const next = `/join/${workspaceSlug}${code ? `?code=${encodeURIComponent(code)}` : ""}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const membership = workspace ? await getWorkspaceMembership(workspace.id, user.id) : undefined;
  if (workspace && membership) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8 text-center">
          <ShieldCheck size={28} className="text-accent mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-fg">You already belong to {workspace.name}</h1>
          <p className="text-sm text-muted mt-2">Open the workspace instead of joining it again.</p>
          <Link href={`/w/${workspace.slug}`} className="mt-6 inline-flex h-10 px-5 rounded-[var(--radius-control)] bg-accent hover:opacity-90 text-accent-fg text-sm font-medium items-center justify-center transition-opacity">
            Open workspace
          </Link>
        </div>
      </div>
    );
  }

  const invite = workspace && code ? await getWorkspaceInviteByCode(workspace.id, code).catch(() => undefined) : undefined;
  const inviteActive = Boolean(invite && isWorkspaceInviteActive(invite));
  const isPreview = workspace ? isWorkspacePreview(workspace.id) : false;
  const error = query.error || (!workspace || !code || !inviteActive ? "This workspace invite is invalid or expired." : "");

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8">
        <div className="w-12 h-12 rounded-[var(--radius-control)] bg-accent-soft border border-accent-border text-accent flex items-center justify-center mb-5">
          <Link2 size={22} />
        </div>
        <h1 className="text-2xl font-semibold text-fg">Join {workspace?.name || "workspace"}</h1>
        <p className="text-sm text-muted mt-2">Membership requires an active invite code that matches this workspace.</p>

        {isPreview ? (
          <div className="st-warn mt-6 rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
            <LockKeyhole size={15} className="mt-0.5 shrink-0" />
            <p><span className="font-semibold">Read-only preview.</span> Join to explore Demo Clinic&apos;s sample workflow. Creating, reviewing, and updating records stays locked.</p>
          </div>
        ) : null}

        {error ? (
          <div className="st-danger mt-6 rounded-[var(--radius-control)] border px-4 py-3 text-sm">{error}</div>
        ) : (
          <form action={joinWorkspaceAction} className="mt-6 space-y-4">
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <input type="hidden" name="code" value={code} />
            <div className="rounded-[var(--radius-control)] border border-border bg-bg px-4 py-3">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-muted">Assigned workspace role</p>
              <p className="text-sm text-fg capitalize mt-1">{invite?.role}</p>
            </div>
            <SubmitButton pendingText="Joining workspace...">
              <LogIn size={16} /> Join workspace
            </SubmitButton>
          </form>
        )}

        <Link href="/onboarding" className="inline-flex mt-6 text-sm text-muted hover:text-fg transition-colors">Back to workspace setup</Link>
      </div>
    </div>
  );
}
