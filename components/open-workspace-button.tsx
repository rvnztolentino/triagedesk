"use client";

import { usePathname } from "next/navigation";
import { switchActiveWorkspaceAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

// Shared control for every "open this workspace" switch prompt. Posts to the
// single switch action, which redirects — the navigation is what re-renders the
// cookie-driven header/sidebar/preview, so the chrome updates without a manual
// refresh. The current path rides along as `next`; the action keeps it only when
// it belongs to the target workspace, otherwise it lands on the workspace itself.
export function OpenWorkspaceButton({
  slug,
  className,
  pendingText = "Opening workspace...",
  children,
}: {
  slug: string;
  className?: string;
  pendingText?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <form action={switchActiveWorkspaceAction}>
      <input type="hidden" name="workspaceSlug" value={slug} />
      <input type="hidden" name="next" value={pathname} />
      <SubmitButton pendingText={pendingText} className={className}>
        {children}
      </SubmitButton>
    </form>
  );
}
