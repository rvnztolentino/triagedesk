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
        <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-8 text-center">
          <ShieldCheck size={28} className="text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white font-space">You already belong to {workspace.name}</h1>
          <p className="text-sm text-neutral-500 mt-2">Open the workspace instead of joining it again.</p>
          <Link href={`/w/${workspace.slug}`} className="mt-6 inline-flex h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-bold items-center justify-center">
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
      <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-8">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5">
          <Link2 size={22} />
        </div>
        <h1 className="text-2xl font-bold text-white font-space">Join {workspace?.name || "workspace"}</h1>
        <p className="text-sm text-neutral-500 mt-2">Membership requires an active invite code that matches this workspace.</p>

        {isPreview ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex items-start gap-2">
            <LockKeyhole size={15} className="mt-0.5 shrink-0 text-amber-400" />
            <p><span className="font-bold text-amber-300">Read-only preview.</span> Join to explore Demo Clinic&apos;s sample workflow. Creating, reviewing, and updating records stays locked.</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        ) : (
          <form action={joinWorkspaceAction} className="mt-6 space-y-4">
            <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
            <input type="hidden" name="code" value={code} />
            <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Assigned workspace role</p>
              <p className="text-sm text-white capitalize mt-1">{invite?.role}</p>
            </div>
            <SubmitButton pendingText="Joining workspace...">
              <LogIn size={16} /> Join workspace
            </SubmitButton>
          </form>
        )}

        <Link href="/onboarding" className="inline-flex mt-6 text-sm text-neutral-500 hover:text-white">Back to workspace setup</Link>
      </div>
    </div>
  );
}
