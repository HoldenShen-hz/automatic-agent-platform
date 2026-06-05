// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const viewModel = {
  items: [{ title: "Audit Trail", description: "review" }],
  loading: false,
  selectedPolicyId: "policy-1",
  policies: [{ id: "policy-1", name: "Prod Change Control", severity: "high" }],
  auditTrail: [],
  exceptionQueue: [{ id: "exc-1", reason: "Temporary bypass", policyId: "policy-1", status: "approved" as const }],
  refresh: vi.fn(async () => undefined),
  selectPolicy: vi.fn(),
  updatePolicy: vi.fn(async () => undefined),
  submitExceptionRequest: vi.fn(async () => undefined),
  approveException: vi.fn(async () => undefined),
  rejectException: vi.fn(async () => undefined),
  filterAuditTrail: vi.fn(),
};

vi.mock("../../../../../../packages/features/governance-compliance/src/hooks", () => ({
  useGovernanceComplianceVm: () => viewModel,
}));

import { GovernanceComplianceWebView } from "../../../../../../packages/features/governance-compliance/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GovernanceComplianceWebView exception actions", () => {
  it("disables approve and reject controls for non-pending exceptions", () => {
    render(<GovernanceComplianceWebView />);

    expect(screen.getByRole("button", { name: "Approve" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Reject" }).hasAttribute("disabled")).toBe(true);
  });
});
