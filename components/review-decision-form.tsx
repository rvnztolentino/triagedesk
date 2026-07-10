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
  decided,
  children,
}: {
  formId: string;
  isPreview: boolean;
  decided: boolean;
  children: React.ReactNode;
}) {
  // Two actions share one form: approve via the form action, reject via the
  // reject button's formAction. Each keeps its own state; we surface whichever
  // failed so the admin stays on the page with an inline message.
  const [approveState, approveAction, approvePending] = useActionState(approveRequestAction, initialState);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectRequestAction, initialState);
  const error = approveState.error ?? rejectState.error;

  return (
    <form id={formId} action={approveAction} className="stack" style={{ gap: 16 }}>
      <fieldset disabled={isPreview || decided} className="stack disabled:opacity-60" style={{ gap: 16 }}>
        {children}

        <div className="card card-pad">
          <div className="section-title" style={{ marginBottom: 14 }}>Decision</div>

          {isPreview ? (
            <div className="banner" style={{ marginBottom: 14 }}>
              <LockKeyhole size={15} className="shrink-0" />
              <span><span className="font-semibold">Preview locked.</span> Review fields are visible for evaluation, but approval actions are disabled.</span>
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2" style={{ marginBottom: 14 }}>
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p><span className="font-semibold">Couldn&apos;t save.</span> {error}</p>
            </div>
          ) : null}

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="note" className="label">Decision note (optional)</label>
            <textarea
              id="note"
              name="note"
              rows={3}
              placeholder="Add context for this decision…"
              className="textarea"
              style={{ minHeight: 64 }}
            />
          </div>

          <div className="cluster" style={{ gap: 10, justifyContent: "space-between" }}>
            <SubmitButton pending={approvePending} pendingText="Approving..." className="btn--sm w-auto">
              {isPreview ? <><LockKeyhole size={15} /> Preview locked</> : <><Check size={15} /> Approve</>}
            </SubmitButton>
            <SubmitButton
              disabled={isPreview}
              formAction={rejectAction}
              pending={rejectPending}
              pendingText="Rejecting..."
              className="btn--danger btn--sm w-auto"
            >
              <X size={15} /> Reject
            </SubmitButton>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
