import { getActiveWorkspaceSlug, getCurrentUser } from "@/lib/auth";
import { workspaceSlugSchema } from "@/lib/schema";
import { getWorkspaceBySlug, getWorkspaceMembership } from "@/lib/workspaces";
import { WorkspaceSwitchPrompt } from "@/components/workspace-switch-prompt";

// Guards every scoped `/w/[slug]/...` page. The root layout (header, sidebar,
// preview banner) renders from the active-workspace cookie, while these pages
// render from the URL slug. When they diverge — opening a link for a workspace
// other than the open one — show a switch prompt instead of a mismatched screen.
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const parsedSlug = workspaceSlugSchema.safeParse(workspaceSlug);
  const activeSlug = await getActiveWorkspaceSlug();

  // Fast path: URL already matches the open workspace (or the slug is malformed
  // and the page will handle it), so render the page untouched.
  if (!parsedSlug.success || activeSlug === parsedSlug.data) {
    return <>{children}</>;
  }

  // Only prompt when the user actually belongs to the URL workspace. Non-members
  // and signed-out users fall through so each page keeps its own auth handling.
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;

  const workspace = await getWorkspaceBySlug(parsedSlug.data);
  const membership = workspace ? await getWorkspaceMembership(workspace.id, user.id) : undefined;
  if (!workspace || !membership) return <>{children}</>;

  const activeWorkspace = activeSlug ? await getWorkspaceBySlug(activeSlug) : undefined;

  return <WorkspaceSwitchPrompt slug={workspace.slug} name={workspace.name} activeName={activeWorkspace?.name} />;
}
