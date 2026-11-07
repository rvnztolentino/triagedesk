export function scopedWorkspaceHref(workspaceSlug: string | undefined, path: string) {
  if (!workspaceSlug) return path;

  const match = path.match(/^([^?#]*)(.*)$/);
  const pathname = match?.[1] || "/";
  const suffix = match?.[2] || "";

  if (pathname === "/") return `/w/${workspaceSlug}/dashboard${suffix}`;
  if (pathname === "/submit") return `/w/${workspaceSlug}/requests/new${suffix}`;
  if (pathname.startsWith("/review")) return `/w/${workspaceSlug}${pathname}${suffix}`;
  if (pathname.startsWith("/tickets")) return `/w/${workspaceSlug}${pathname}${suffix}`;
  if (pathname.startsWith("/settings")) return `/w/${workspaceSlug}${pathname}${suffix}`;
  if (pathname.startsWith("/users")) return `/w/${workspaceSlug}${pathname}${suffix}`;
  if (pathname.startsWith("/notifications")) return `/w/${workspaceSlug}${pathname}${suffix}`;
  if (pathname.startsWith("/requests")) return `/w/${workspaceSlug}${pathname}${suffix}`;
  if (pathname.startsWith("/attachments")) return `/w/${workspaceSlug}${pathname}${suffix}`;

  return path;
}

export function requestReceivedHref(workspaceSlug: string | undefined, requestId: string) {
  return workspaceSlug ? `/w/${workspaceSlug}/requests/${requestId}` : `/submit/confirm?id=${requestId}`;
}

// Decides whether a sidebar item (given by its unscoped path) is the current
// section. The sidebar highlight and the header title both read from this, so they
// always agree.
export function isNavPathActive(pathname: string, itemPath: string, activeSlug: string | undefined) {
  const href = scopedWorkspaceHref(activeSlug, itemPath);
  if (pathname === href) return true;
  // A signed-in visitor at `/` (where the brand link used to point) sees the dashboard.
  if (itemPath === "/") return pathname === "/";
  if (itemPath === "/onboarding") return isWorkspacePagePath(pathname, activeSlug);
  return pathname.startsWith(href);
}

// The workspace hub, a workspace's own management page (`/w/<slug>`, where a newly
// created or joined workspace lands), and any page of a workspace other than the open
// one (those render the switch prompt) all belong to the Workspace section.
function isWorkspacePagePath(pathname: string, activeSlug: string | undefined) {
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  const match = pathname.match(/^\/w\/([^/]+)(\/.*)?$/);
  if (!match) return false;
  const [, slug, rest] = match;
  return !rest || rest === "/" || slug !== activeSlug;
}
