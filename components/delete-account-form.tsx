"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/actions";

function DeleteButton({ armed }: { armed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!armed || pending} className="btn btn--danger btn--block">
      {pending ? (
        <>
          <LoaderCircle size={15} className="animate-spin" /> Deleting account...
        </>
      ) : (
        <>
          <Trash2 size={15} /> Permanently delete account
        </>
      )}
    </button>
  );
}

// Requires the user to type DELETE before the destructive submit unlocks, matching
// the workspace-deletion confirmation pattern.
export function DeleteAccountForm() {
  const [confirmation, setConfirmation] = React.useState("");

  return (
    <form action={deleteAccountAction} className="stack" style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="confirmation" className="label">
          Type <span className="mono">DELETE</span> to confirm
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="text"
          autoComplete="off"
          className="input"
          placeholder="DELETE"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      <DeleteButton armed={confirmation === "DELETE"} />
    </form>
  );
}
