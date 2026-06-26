"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, LockKeyhole, MapPin, User } from "lucide-react";
import { submitRequestAction, type SubmitRequestState } from "@/app/actions";
import { RequestAttachmentsInput } from "@/components/request-attachments-input";
import { SubmitButton } from "@/components/submit-button";

const initialState: SubmitRequestState = {};

export function SubmitRequestForm({
  workspaceSlug,
  isPreview,
  ticketsHref,
}: {
  workspaceSlug?: string;
  isPreview: boolean;
  ticketsHref: string;
}) {
  const [state, formAction] = useActionState(submitRequestAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
      {isPreview ? (
        <div className="st-warn rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <LockKeyhole size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Preview locked.</span> This sample form is visible for evaluation. Create your own workspace to submit a request.</p>
        </div>
      ) : null}
      {state.error ? (
        <div role="alert" className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Couldn&apos;t submit.</span> {state.error}</p>
        </div>
      ) : null}
      <fieldset disabled={isPreview} className="space-y-6 disabled:opacity-60">
        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium text-fg">What&apos;s the issue?</label>
          <textarea
            id="description"
            name="description"
            required
            minLength={10}
            rows={5}
            placeholder="E.g., Aircon in Room 304 is leaking again. Floor is wet near the outlet."
            className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-4 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors resize-none placeholder:text-faint"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium text-fg flex items-center gap-2">
              <MapPin size={16} className="text-muted" /> Location
            </label>
            <input
              id="location"
              name="location"
              required
              type="text"
              placeholder="Building A, Room 304"
              className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors placeholder:text-faint"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="contactName" className="text-sm font-medium text-fg flex items-center gap-2">
              <User size={16} className="text-muted" /> Contact Name
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              placeholder="Jane Doe"
              className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors placeholder:text-faint"
            />
          </div>
        </div>

        <div className="space-y-2 relative">
          <label htmlFor="urgencyNote" className="text-sm font-medium text-fg flex items-center gap-2">
            <AlertTriangle size={16} className="text-muted" /> Urgency Note (Optional)
          </label>
          <input
            id="urgencyNote"
            name="urgencyNote"
            type="text"
            placeholder="Why is it urgent?"
            className="w-full bg-bg border border-border rounded-[var(--radius-control)] p-3 text-sm focus:outline-none focus:border-accent-border text-fg transition-colors pr-10 placeholder:text-faint"
          />
        </div>

        <RequestAttachmentsInput />

        <div className="pt-6 border-t border-border flex items-center justify-between">
          <Link href={ticketsHref} className="text-sm font-medium text-muted hover:text-fg px-4 py-2 transition-colors">
            Cancel
          </Link>
          <SubmitButton pendingText="Uploading..." className="w-auto h-auto px-8 py-3">
            {isPreview ? <><LockKeyhole size={16} /> Preview locked</> : <>Submit Request <ArrowRight size={16} /></>}
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
