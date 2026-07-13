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
