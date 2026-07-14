import Link from "next/link";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { OpenWorkspaceButton } from "@/components/open-workspace-button";

// Shown by the scoped `/w/[slug]` layout when a user opens a link for a workspace
// they belong to that is not their currently active one. Switching only happens
// on confirm; the deep-linked page then loads in place once the cookie matches.
export function WorkspaceSwitchPrompt({
  slug,
  name,
  activeName,
}: {
  slug: string;
  name: string;
  activeName?: string;
}) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-surface border border-border rounded-[var(--radius-card)] p-8 text-center">
        <div className="w-12 h-12 rounded-[var(--radius-control)] bg-accent-soft border border-accent-border text-accent flex items-center justify-center mx-auto mb-5">
          <LayoutGrid size={22} />
        </div>
        <h1 className="text-2xl font-semibold text-fg">You&apos;re viewing {name}</h1>
        <p className="text-sm text-muted mt-2">
          {activeName ? (
            <>
              <span className="font-medium text-fg">{activeName}</span> is your open workspace. Open{" "}
              {name} to switch your active workspace.
            </>
          ) : (
            <>Open {name} to switch your active workspace.</>
          )}
        </p>
        <div className="mt-6">
          <OpenWorkspaceButton slug={slug} className="w-auto mx-auto">
            <ArrowUpRight size={16} /> Open workspace
          </OpenWorkspaceButton>
        </div>
        <Link href="/onboarding" className="inline-flex mt-5 text-sm text-muted hover:text-fg transition-colors">
          Back to workspaces
        </Link>
      </div>
    </div>
  );
}
