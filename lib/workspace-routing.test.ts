import { describe, expect, it } from "vitest";
import { isNavPathActive, requestReceivedHref, scopedWorkspaceHref } from "./workspace-routing";

describe("workspace routing", () => {
  it("maps operational routes into a workspace slug", () => {
    expect(scopedWorkspaceHref("demo-clinic", "/")).toBe("/w/demo-clinic/dashboard");
    expect(scopedWorkspaceHref("demo-clinic", "/submit")).toBe("/w/demo-clinic/requests/new");
    expect(scopedWorkspaceHref("demo-clinic", "/review/REQ-1001")).toBe("/w/demo-clinic/review/REQ-1001");
    expect(scopedWorkspaceHref("demo-clinic", "/tickets?filter=active&page=1")).toBe("/w/demo-clinic/tickets?filter=active&page=1");
    expect(scopedWorkspaceHref("demo-clinic", "/settings")).toBe("/w/demo-clinic/settings");
    expect(scopedWorkspaceHref("demo-clinic", "/users")).toBe("/w/demo-clinic/users");
    expect(scopedWorkspaceHref(undefined, "/tickets")).toBe("/tickets");
  });

  it("uses request detail routes after workspace-scoped submission", () => {
    expect(requestReceivedHref("demo-clinic", "REQ-1001")).toBe("/w/demo-clinic/requests/REQ-1001");
    expect(requestReceivedHref(undefined, "REQ-1001")).toBe("/submit/confirm?id=REQ-1001");
  });

  it("marks the current sidebar section, including the bare home and workspace pages", () => {
    expect(isNavPathActive("/w/acme/dashboard", "/", "acme")).toBe(true);
    expect(isNavPathActive("/", "/", "acme")).toBe(true);
    expect(isNavPathActive("/w/acme/tickets", "/", "acme")).toBe(false);
    expect(isNavPathActive("/w/acme/tickets/TKT-1", "/tickets", "acme")).toBe(true);
    expect(isNavPathActive("/w/acme/requests/new", "/submit", "acme")).toBe(true);

    expect(isNavPathActive("/onboarding", "/onboarding", "acme")).toBe(true);
    expect(isNavPathActive("/w/acme", "/onboarding", "acme")).toBe(true);
    expect(isNavPathActive("/w/new-team", "/onboarding", "acme")).toBe(true);
    expect(isNavPathActive("/w/new-team", "/onboarding", undefined)).toBe(true);
    expect(isNavPathActive("/w/new-team/tickets", "/onboarding", "acme")).toBe(true);
    expect(isNavPathActive("/w/acme/tickets", "/onboarding", "acme")).toBe(false);
    expect(isNavPathActive("/w/new-team", "/", "acme")).toBe(false);
  });
});
