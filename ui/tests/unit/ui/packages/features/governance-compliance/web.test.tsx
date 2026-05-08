import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUpdatePolicy = vi.fn(async () => undefined);
const mockApproveException = vi.fn(async () => undefined);
const mockRejectException = vi.fn(async () => undefined);

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FeatureWorkbenchPanel: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={item.title}>{item.title}</div>)}</div>
  ),
}), { virtual: true });

vi.mock("../../../../../../packages/features/governance-compliance/src/hooks", () => ({
  useGovernanceComplianceVm: () => ({
    items: [{ title: "Audit Trail", description: "review" }],
    policies: [{ id: "policy-1", name: "Prod Change Control", severity: "high" }],
    auditTrail: [{ id: "audit-1", action: "policy.update", actor: "platform-sre", resource: "policy-1", outcome: "success" }],
    exceptionQueue: [{ id: "exc-1", reason: "Temporary bypass", status: "pending" }],
    updatePolicy: mockUpdatePolicy,
    approveException: mockApproveException,
    rejectException: mockRejectException,
  }),
}));

import { GovernanceComplianceWebView } from "../../../../../../packages/features/governance-compliance/src/web";

afterEach(() => {
  cleanup();
});

describe("GovernanceComplianceWebView", () => {
  it("renders policy, audit, and exception panels", () => {
    render(<GovernanceComplianceWebView />);

    expect(screen.queryByText("Policy Editor")).not.toBeNull();
    expect(screen.queryByText("Prod Change Control")).not.toBeNull();
    expect(screen.getAllByText("Audit Trail").length).toBeGreaterThan(0);
    expect(screen.queryByText("policy.update")).not.toBeNull();
    expect(screen.queryByText("Exception Management")).not.toBeNull();
    expect(screen.queryByText("Temporary bypass")).not.toBeNull();
  });

  it("wires policy review and exception actions", () => {
    render(<GovernanceComplianceWebView />);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(mockUpdatePolicy).toHaveBeenCalledWith("policy-1", {});
    expect(mockApproveException).toHaveBeenCalledWith("exc-1");
    expect(mockRejectException).toHaveBeenCalledWith("exc-1", "rejected_from_web");
  });
});
