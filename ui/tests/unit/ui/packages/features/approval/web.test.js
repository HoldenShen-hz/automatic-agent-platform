import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mockApprove = vi.fn(async () => undefined);
const mockReject = vi.fn(async () => undefined);
const mockDelegate = vi.fn(async () => undefined);
const mockRequestMoreContext = vi.fn(async () => undefined);
const mockSelectApproval = vi.fn();
vi.mock("@aa/ui-core", () => ({
    designTokens: {
        color: { border: "#d0d7de" },
        semantic: { color: { surfaceSelected: "#f3f4f6" } },
    },
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    KeyValueTable: ({ rows }) => (_jsx("div", { children: rows.map((row) => (_jsx("div", { children: `${row.key}: ${row.value}` }, row.key))) })),
    ListCard: ({ items }) => (_jsx("div", { children: items.map((item) => _jsx("div", { children: item.title }, item.title)) })),
    ThreePaneLayout: ({ left, center, right }) => (_jsxs("div", { children: [_jsx("div", { children: left }), _jsx("div", { children: center }), _jsx("div", { children: right })] })),
}));
vi.mock("../../../../../../packages/features/approval/src/hooks", () => ({
    useApprovalCenterVm: () => ({
        approvals: [],
        queueItems: [
            { id: "approval-1", title: "task-1", subtitle: "critical" },
        ],
        selectedId: "approval-1",
        selectedApproval: {
            approvalId: "approval-1",
            taskId: "task-1",
            riskLevel: "critical",
            reasonSummary: "Production rollout",
            deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            policySource: "domain-policy",
            recommendedOption: "approve",
        },
        actionHistory: [],
        queueDepth: 1,
        pendingAction: false,
        selectApproval: mockSelectApproval,
        approve: mockApprove,
        reject: mockReject,
        delegate: mockDelegate,
        requestMoreContext: mockRequestMoreContext,
    }),
}));
import { ApprovalWebView } from "../../../../../../packages/features/approval/src/web";
describe("ApprovalWebView", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.clearAllMocks();
    });
    it("renders deadline, policy source, and recommended option", () => {
        render(_jsx(ApprovalWebView, {}));
        expect(screen.getByText(/Deadline:/)).toBeInTheDocument();
        expect(screen.getByText(/Policy Source: domain-policy/)).toBeInTheDocument();
        expect(screen.getByText(/Recommended Option: approve/)).toBeInTheDocument();
    });
    it("supports request-context and decision actions", () => {
        render(_jsx(ApprovalWebView, {}));
        const approveButton = screen.getByRole("button", { name: "Approve" });
        const rejectButton = screen.getByRole("button", { name: "Reject" });
        const contextButton = screen.getByRole("button", { name: "Request context" });
        fireEvent.pointerDown(approveButton);
        fireEvent.click(approveButton);
        fireEvent.pointerDown(rejectButton);
        fireEvent.click(rejectButton);
        fireEvent.pointerDown(contextButton);
        fireEvent.click(contextButton);
        expect(mockApprove).toHaveBeenCalled();
        expect(mockReject).toHaveBeenCalled();
        expect(mockRequestMoreContext).toHaveBeenCalled();
    });
});
