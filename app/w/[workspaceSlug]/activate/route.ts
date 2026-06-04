import { NextResponse } from "next/server";
import { getCurrentUser, setActiveWorkspaceCookie } from "@/lib/auth";
import { workspaceSlugSchema } from "@/lib/schema";
import { requireWorkspaceMembership } from "@/lib/workspaces";

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
    await requireWorkspaceMembership(parsedSlug.data, user.id);
    await setActiveWorkspaceCookie(parsedSlug.data);
    return NextResponse.redirect(new URL(`/w/${parsedSlug.data}`, url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace access is required.";
    return NextResponse.redirect(new URL(`/onboarding?error=${encodeURIComponent(message)}`, url));
  }
}
