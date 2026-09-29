"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertTriangle, MapPin, Sparkles, User } from "lucide-react";
import { submitRequestAction } from "@/app/actions";
import { AiTriageLoading } from "@/components/ai-triage-loading";
import { CharCounter } from "@/components/char-limited-textarea";
import { RequestAttachmentsInput } from "@/components/request-attachments-input";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/errors";

const initialState: ActionState = {};

const SAMPLES = [
  "The AC in Room 204 is leaking water all over the floor.",
  "Several staff can't log into email; password reset returns an error.",
  "Badge reader at the loading dock is offline and staff can't get in.",
  "A ceiling tile near the elevator is sagging and might fall.",
];

// While the request is submitting, step the form aside and show the dedicated
// triaging screen in its place (no blur over the form).
function FormBody({
  allowAttachments,
  ticketsHref,
  description,
  setDescription,
}: {
  allowAttachments: boolean;
  ticketsHref: string;
  description: string;
  setDescription: (value: string) => void;
}) {
  const { pending } = useFormStatus();

  if (pending) return <AiTriageLoading />;

  return (
    <fieldset className="space-y-6">
      <div className="field">
        <label htmlFor="description" className="label">
          Description <span style={{ color: "var(--danger)" }} aria-hidden="true">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={1200}
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. Aircon in Room 304 is leaking again. Floor is wet near the outlet."
          className="textarea"
        />
        <CharCounter length={description.length} max={1200} />
        <div className="cluster wrap" style={{ gap: 6, marginTop: 2 }}>
          <span className="field-hint">Try:</span>
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              className="chip"
              style={{ fontSize: 11.5, padding: "3px 8px" }}
              onClick={() => setDescription(sample)}
            >
              {sample.slice(0, 26)}…
            </button>
          ))}
        </div>
      </div>

      <div className="grid cols-2" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="location" className="label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <MapPin size={13} className="text-muted" /> Location
          </label>
          <input id="location" name="location" type="text" maxLength={160} placeholder="Building A, Room 304" className="input" />
        </div>

        <div className="field">
          <label htmlFor="contactName" className="label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <User size={13} className="text-muted" /> Contact name
          </label>
          <input id="contactName" name="contactName" type="text" maxLength={80} placeholder="Who to reach" className="input" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="urgencyNote" className="label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <AlertTriangle size={13} className="text-muted" /> Urgency note
        </label>
        <input id="urgencyNote" name="urgencyNote" type="text" maxLength={400} placeholder="Why is it urgent?" className="input" />
      </div>

      {/* A demo session is refused storage access server-side, so showing it a file
          picker would only produce an error after the upload. Everything else on this
          form works for them, including real triage. */}
      {allowAttachments ? (
        <RequestAttachmentsInput />
      ) : (
        <p className="field-hint">Attachments need a free account. Everything else here works.</p>
      )}

      <div className="pt-5 border-t border-border flex items-center justify-between">
        <Link href={ticketsHref} className="btn btn--ghost btn--sm">Cancel</Link>
        <SubmitButton pendingText="Triaging..." className="btn--sm w-auto">
          <Sparkles size={15} /> Submit &amp; triage
        </SubmitButton>
      </div>
    </fieldset>
  );
}

export function SubmitRequestForm({
  workspaceSlug,
  allowAttachments,
  ticketsHref,
}: {
  workspaceSlug?: string;
  allowAttachments: boolean;
  ticketsHref: string;
}) {
  const [state, formAction] = useActionState(submitRequestAction, initialState);
  const [description, setDescription] = useState("");

  return (
    <form action={formAction} className="space-y-6">
      {workspaceSlug ? <input type="hidden" name="workspaceSlug" value={workspaceSlug} /> : null}
      {state.error ? (
        <div role="alert" className="st-danger rounded-[var(--radius-control)] border px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">Couldn&apos;t submit.</span> {state.error}</p>
        </div>
      ) : null}
      <FormBody
        allowAttachments={allowAttachments}
        ticketsHref={ticketsHref}
        description={description}
        setDescription={setDescription}
      />
    </form>
  );
}
