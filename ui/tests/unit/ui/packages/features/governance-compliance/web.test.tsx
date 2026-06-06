// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUpdatePolicy = vi.fn(async () => undefined);
const mockApproveException = vi.fn(async () => undefined);
const mockRejectException = vi.fn(async () => undefined);
const mockSelectPolicy = vi.fn();
const mockSubmitExceptionRequest = vi.fn(async () => undefined);
const mockFilterAuditTrail = vi.fn();
const mockRefresh = vi.fn(async () => undefined);
let capturedWorkbenchItems: Array<{ title: string; description: string; detailRows?: Array<{ key: string; value: string }> }> = [];

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FeatureWorkbenchPanel: (
    { items, actions }: {
      items: Array<{ title: string; description: string; detailRows?: Array<{ key: string; value: string }> }>;
      actions: Array<{ id: string; label: string; onTrigger?: () => void | Promise<void> }>;
    },
  ) => {
    capturedWorkbenchItems = items;
    return (
      <div>
        {items.map((item) => <div key={item.title}>{item.title}</div>)}
      {actions.map((action) => (
        <button key={action.id} type="button" onClick={() => void action.onTrigger?.()}>
          {action.label}
        </button>
      ))}
      </div>
    );
  },
}));

vi.mock("../../../../../../packages/features/governance-compliance/src/hooks", () => ({
  useGovernanceComplianceVm: () => ({
    items: [{ title: "Audit Trail", description: "review" }],
    loading: false,
    selectedPolicyId: "policy-1",
    policies: [{ id: "policy-1", name: "Prod Change Control", severity: "high" }],
    auditTrail: [{ id: "audit-1", action: "policy.update", actor: "platform-sre", resource: "policy-1", outcome: "success" }],
    exceptionQueue: [{ id: "exc-1", reason: "Temporary bypass", status: "pending" }],
    refresh: mockRefresh,
    selectPolicy: mockSelectPolicy,
    updatePolicy: mockUpdatePolicy,
    submitExceptionRequest: mockSubmitExceptionRequest,
    approveException: mockApproveException,
    rejectException: mockRejectException,
    filterAuditTrail: mockFilterAuditTrail,
  }),
}));

import { GovernanceComplianceWebView } from "../../../../../../packages/features/governance-compliance/src/web";

afterEach(() => {
  cleanup();
  capturedWorkbenchItems = [];
});

describe("GovernanceComplianceWebView", () => {
  it("renders policy, audit, and exception panels", () => {
    render(<GovernanceComplianceWebView />);

    expect(screen.queryByText("策略编辑器")).not.toBeNull();
    expect(screen.queryByText(/Prod Change Control/)).not.toBeNull();
    expect(screen.getAllByText("Audit Trail").length).toBeGreaterThan(0);
    expect(screen.queryByText("policy.update")).not.toBeNull();
    expect(screen.queryByText("异常管理")).not.toBeNull();
    expect(screen.queryByText("Temporary bypass")).not.toBeNull();
  });

  it("suppresses fallback item-summary detail rows in the workbench panel", () => {
    render(<GovernanceComplianceWebView />);

    expect(capturedWorkbenchItems).toHaveLength(1);
    expect(capturedWorkbenchItems[0]?.detailRows ?? []).toHaveLength(0);
  });

  it("wires policy review and exception actions", () => {
    render(<GovernanceComplianceWebView />);

    fireEvent.click(screen.getByRole("button", { name: "刷新治理状态" }));
    fireEvent.click(screen.getByRole("button", { name: "查看审计轨迹" }));
    fireEvent.click(screen.getByRole("button", { name: "发起策略例外" }));
    fireEvent.click(screen.getByRole("button", { name: "升级委托审批" }));
    fireEvent.click(screen.getByRole("button", { name: "审阅" }));
    fireEvent.click(screen.getByRole("button", { name: "标记已审阅" }));
    fireEvent.click(screen.getByRole("button", { name: "批准" }));
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));

    expect(mockRefresh).toHaveBeenCalled();
    expect(mockSelectPolicy).toHaveBeenCalledWith("policy-1");
    expect(mockUpdatePolicy).toHaveBeenCalledWith("policy-1", { lastReviewSource: "web_console" });
    expect(mockFilterAuditTrail).toHaveBeenCalled();
    expect(mockSubmitExceptionRequest).toHaveBeenCalledWith("manual_exception_review_requested", "policy-1");
    expect(mockSubmitExceptionRequest).toHaveBeenCalledWith("governance_escalation_requested", "policy-1");
    expect(mockApproveException).toHaveBeenCalledWith("exc-1");
    expect(mockRejectException).toHaveBeenCalledWith("exc-1", "rejected_from_web");
  });
});
