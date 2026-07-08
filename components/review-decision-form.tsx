"use client";

import { useActionState } from "react";
import { AlertTriangle, Check, LockKeyhole, X } from "lucide-react";
import { approveRequestAction, rejectRequestAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/errors";

const initialState: ActionState = {};

export function ReviewDecisionForm({
  formId,
  isPreview,
  children,
}: {
  formId: string;
  isPreview: boolean;
  children: React.ReactNode;
}) {
  // Two actions share one form: approve via the form action, reject via the
  // reject button's formAction. Each keeps its own state; we surface whichever
  // failed so the admin stays on the page with an inline message.
  const [approveState, approveAction, approvePending] = useActionState(approveRequestAction, initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectRequestAction, initialState);
  const error = approveState.error ?? rejectState.error;

  return (
    <form id={formId} action={approveAction} className="space-y-6">
      {isPreview ? (
        <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <LockKeyhole size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Preview locked.</span> Review fields are visible for evaluation, but approval actions are disabled.</p>
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Couldn&apos;t save.</span> {error}</p>
        </div>
      ) : null}
      <fieldset disabled={isPreview} className="space-y-6 disabled:opacity-60">
        {children}

        <div className="pt-6 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SubmitButton pending={approvePending} pendingText="Approving..." className="sm:w-auto">
            {isPreview ? <><LockKeyhole size={16} /> Preview locked</> : <><Check size={16} /> Approve &amp; Dispatch</>}
          </SubmitButton>
          <SubmitButton
            disabled={isPreview}
            formAction={rejectAction}
            pending={rejectPending}
            pendingText="Rejecting..."
            className="btn--danger btn--block sm:w-auto"
          >
            <X size={16} /> Reject
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
