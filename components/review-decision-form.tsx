"use client";

import { useActionState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { approveRequestAction, rejectRequestAction } from "@/app/actions";
import { CharLimitedTextarea } from "@/components/char-limited-textarea";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/errors";

const initialState: ActionState = {};

export function ReviewDecisionForm({
  formId,
  decided,
  children,
}: {
  formId: string;
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
      <fieldset disabled={decided} className="stack disabled:opacity-60" style={{ gap: 16 }}>
        {children}

        <div className="card card-pad">
          <div className="section-title" style={{ marginBottom: 14 }}>Decision</div>

          {error ? (
            <div role="alert" className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2" style={{ marginBottom: 14 }}>
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <p><span className="font-semibold">Couldn&apos;t save.</span> {error}</p>
            </div>
          ) : null}

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="note" className="label">Decision note (optional)</label>
            <CharLimitedTextarea
              id="note"
              name="note"
              max={2000}
              rows={3}
              placeholder="Add context for this decision…"
              className="textarea"
              style={{ minHeight: 64 }}
            />
          </div>

          <div className="cluster" style={{ gap: 10, justifyContent: "space-between" }}>
            <SubmitButton pending={approvePending} pendingText="Approving..." className="btn--sm w-auto">
              <Check size={15} /> Approve
            </SubmitButton>
            <SubmitButton
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
