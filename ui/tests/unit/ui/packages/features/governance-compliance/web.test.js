import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mockUpdatePolicy = vi.fn(async () => undefined);
const mockApproveException = vi.fn(async () => undefined);
const mockRejectException = vi.fn(async () => undefined);
const mockSelectPolicy = vi.fn();
const mockSubmitExceptionRequest = vi.fn(async () => undefined);
const mockFilterAuditTrail = vi.fn();
vi.mock("@aa/ui-core", () => ({
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    FeatureWorkbenchPanel: ({ items, actions }) => (_jsxs("div", { children: [items.map((item) => _jsx("div", { children: item.title }, item.title)), actions.map((action) => (_jsx("button", { type: "button", onClick: () => void action.onTrigger?.(), children: action.label }, action.id)))] })),
}));
vi.mock("../../../../../../packages/features/governance-compliance/src/hooks", () => ({
    useGovernanceComplianceVm: () => ({
        items: [{ title: "Audit Trail", description: "review" }],
        selectedPolicyId: "policy-1",
        policies: [{ id: "policy-1", name: "Prod Change Control", severity: "high" }],
        auditTrail: [{ id: "audit-1", action: "policy.update", actor: "platform-sre", resource: "policy-1", outcome: "success" }],
        exceptionQueue: [{ id: "exc-1", reason: "Temporary bypass", status: "pending" }],
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
});
describe("GovernanceComplianceWebView", () => {
    it("renders policy, audit, and exception panels", () => {
        render(_jsx(GovernanceComplianceWebView, {}));
        expect(screen.queryByText("Policy Editor")).not.toBeNull();
        expect(screen.queryByText("Prod Change Control")).not.toBeNull();
        expect(screen.getAllByText("Audit Trail").length).toBeGreaterThan(0);
        expect(screen.queryByText("policy.update")).not.toBeNull();
        expect(screen.queryByText("Exception Management")).not.toBeNull();
        expect(screen.queryByText("Temporary bypass")).not.toBeNull();
    });
    it("wires policy review and exception actions", () => {
        render(_jsx(GovernanceComplianceWebView, {}));
        fireEvent.click(screen.getByRole("button", { name: "汇总治理状态" }));
        fireEvent.click(screen.getByRole("button", { name: "审阅字段策略" }));
        fireEvent.click(screen.getByRole("button", { name: "查看审计轨迹" }));
        fireEvent.click(screen.getByRole("button", { name: "管理异常" }));
        fireEvent.click(screen.getByRole("button", { name: "升级委托审批" }));
        fireEvent.click(screen.getByRole("button", { name: "Review" }));
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(mockSelectPolicy).toHaveBeenCalledWith("policy-1");
        expect(mockUpdatePolicy).toHaveBeenCalledWith("policy-1", {});
        expect(mockFilterAuditTrail).toHaveBeenCalled();
        expect(mockSubmitExceptionRequest).toHaveBeenCalledWith("manual_exception_review_requested", "policy-1");
        expect(mockSubmitExceptionRequest).toHaveBeenCalledWith("governance_escalation_requested", "policy-1");
        expect(mockApproveException).toHaveBeenCalledWith("exc-1");
        expect(mockRejectException).toHaveBeenCalledWith("exc-1", "rejected_from_web");
    });
});
