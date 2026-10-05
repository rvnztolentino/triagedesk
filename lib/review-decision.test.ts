import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const formSource = readFileSync(new URL("../components/review-decision-form.tsx", import.meta.url), "utf8");

describe("review decision form", () => {
  // Rejecting locks the request for good, the same as the other one-way actions that
  // already ask first (remove member, delete invite, leave workspace).
  it("asks before rejecting a request", () => {
    const rejectButton = formSource.slice(formSource.indexOf("formAction={rejectAction}"), formSource.indexOf("<X size={15} /> Reject"));

    expect(rejectButton).toContain('if (!window.confirm("Reject this request? This cannot be undone.")) event.preventDefault();');
  });

  it("does not ask before approving", () => {
    const approveButton = formSource.slice(formSource.indexOf("<SubmitButton pending={approvePending}"), formSource.indexOf("<Check size={15} /> Approve"));

    expect(approveButton).not.toContain("window.confirm");
  });

  // Approve is the form's default action, so Enter in the title field used to
  // approve the request mid-edit.
  it("stops Enter in a text field from approving the request", () => {
    expect(formSource).toContain('if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {');
    expect(formSource).toContain("<form id={formId} action={approveAction} onKeyDown={blockEnterSubmit}");
  });
});
