import { NextResponse } from "next/server";
import { applyActiveWorkspaceCookie, getCurrentUser } from "@/lib/auth";
import { workspaceSlugSchema } from "@/lib/schema";
import { requireWorkspaceMembership } from "@/lib/workspaces";
import { scopedWorkspaceHref } from "@/lib/workspace-routing";

export async function GET(request: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug: rawWorkspaceSlug } = await params;
  const parsedSlug = workspaceSlugSchema.safeParse(rawWorkspaceSlug);
  const url = new URL(request.url);

  if (!parsedSlug.success) {
    return NextResponse.redirect(new URL("/onboarding", url));
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/w/${parsedSlug.data}/activate`)}`, url));
  }

  try {
    const access = await requireWorkspaceMembership(parsedSlug.data, user.id);
    const destination =
      access.membership.role !== "requester"
        ? scopedWorkspaceHref(parsedSlug.data, "/")
        : scopedWorkspaceHref(parsedSlug.data, "/tickets");
    // Write the cookie onto the redirect response itself, because a `next/headers`
    // mutation would be dropped from this hand-built response, leaving the
    // header/sidebar pinned to the previously active workspace.
    return applyActiveWorkspaceCookie(NextResponse.redirect(new URL(destination, url)), parsedSlug.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace access is required.";
    return NextResponse.redirect(new URL(`/onboarding?error=${encodeURIComponent(message)}`, url));
  }
}
