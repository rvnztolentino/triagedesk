import Link from "next/link";
import { AlertTriangle, UserRound } from "lucide-react";
import { updateAccountNameAction } from "@/app/actions";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { SubmitButton } from "@/components/submit-button";
import { getUserProfile, requireRealUser } from "@/lib/auth";
import { MAX_NAME_CHANGES, nameChangeStatus } from "@/lib/display-name";
import { countOwnedWorkspaces } from "@/lib/workspaces";

function formatResetDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export const dynamic = "force-dynamic";

const SUCCESS_MESSAGES: Record<string, string> = {
  name: "Your name has been updated.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  // Account settings belong to a real account. A demo visitor has no Clerk user behind
  // their profile, so send them back rather than render a form that can only fail.
  const user = await requireRealUser();
  const [profile, ownedWorkspaces] = await Promise.all([
    getUserProfile(user.id),
    countOwnedWorkspaces(user.id),
  ]);
  const params = await searchParams;

  const displayName = profile?.displayName ?? user.displayName;
  const successMessage = params.updated ? SUCCESS_MESSAGES[params.updated] : undefined;

  const changeStatus = nameChangeStatus(profile?.nameChangeCount ?? 0, profile?.nameChangeWindowStart);
  const changesExhausted = changeStatus.remaining <= 0;

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-5">
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Account settings
        </h1>
        <p className="page-sub">Manage your profile, sign-in security, and account for {user.email}.</p>
      </div>

      {params.error ? (
        <div className="st-danger rounded-[var(--radius-card)] border px-4 py-3 text-sm">{params.error}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-[var(--radius-card)] border border-accent-border bg-accent-soft px-4 py-3 text-sm text-accent">
          {successMessage}
        </div>
      ) : null}

      <div className="card">
        <div className="panel-head">
          <div className="section-title">Profile</div>
          <UserRound size={16} className="faint" />
        </div>
        <div className="card-pad">
          <form action={updateAccountNameAction} className="stack" style={{ gap: 12 }}>
            <div className="field">
              <label htmlFor="displayName" className="label">Full name</label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                maxLength={80}
                defaultValue={displayName}
                disabled={changesExhausted}
                className="input"
                placeholder="Your name"
              />
              <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {changesExhausted && changeStatus.resetAt
                  ? `You've used your ${MAX_NAME_CHANGES} name changes. You can change it again on ${formatResetDate(changeStatus.resetAt)}.`
                  : `Shown to other members of your workspaces. You can change your name ${changeStatus.remaining} more time${changeStatus.remaining === 1 ? "" : "s"} before it locks for 3 months.`}
              </p>
            </div>
            <div>
              <SubmitButton pendingText="Saving..." className="btn--primary" disabled={changesExhausted}>
                Save changes
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>

      <div className="card" style={{ borderColor: "var(--danger-border, var(--border))" }}>
        <div className="panel-head">
          <div className="section-title">Delete account</div>
          <AlertTriangle size={16} className="faint" />
        </div>
        <div className="card-pad stack" style={{ gap: 14 }}>
          <p className="muted" style={{ fontSize: 13.5 }}>
            Permanently delete your account and remove you from every workspace you belong to. This can&apos;t be undone.
          </p>
          {ownedWorkspaces > 0 ? (
            <div className="banner" style={{ alignItems: "flex-start" }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ lineHeight: 1.5 }}>
                You own {ownedWorkspaces} workspace{ownedWorkspaces === 1 ? "" : "s"}. Delete
                {ownedWorkspaces === 1 ? " it" : " them"} or hand{ownedWorkspaces === 1 ? " it" : " them"} off from your{" "}
                <Link href="/onboarding" className="link">workspaces</Link> before deleting your account.
              </span>
            </div>
          ) : (
            <DeleteAccountForm />
          )}
        </div>
      </div>
    </div>
  );
}
