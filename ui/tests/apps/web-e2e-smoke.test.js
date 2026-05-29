import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const { mockRestClient } = vi.hoisted(() => ({
    mockRestClient: {},
}));
const { mockApproveApproval, mockRejectApproval, mockDelegateApproval, mockRequestMoreContextApproval, mockUpdatePreferences } = vi.hoisted(() => ({
    mockApproveApproval: vi.fn().mockResolvedValue(undefined),
    mockRejectApproval: vi.fn().mockResolvedValue(undefined),
    mockDelegateApproval: vi.fn().mockResolvedValue(undefined),
    mockRequestMoreContextApproval: vi.fn().mockResolvedValue(undefined),
    mockUpdatePreferences: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@aa/ui-core", () => ({
    designTokens: {
        color: { border: "#d0d7de" },
        semantic: { color: { surfaceSelected: "#f3f4f6" } },
    },
    FeatureScaffold: ({ children, title }) => (_jsxs("section", { children: [_jsx("h2", { children: title }), children] })),
    KeyValueTable: ({ rows }) => (_jsx("dl", { children: rows.map((row) => (_jsxs("div", { children: [_jsx("dt", { children: row.key }), _jsx("dd", { children: row.value })] }, row.key))) })),
    ListCard: ({ items }) => (_jsx("ul", { children: items.map((item) => (_jsxs("li", { children: [_jsx("strong", { children: item.title }), _jsx("span", { children: item.description })] }, item.title))) })),
    ThreePaneLayout: ({ left, center, right }) => (_jsxs("div", { children: [_jsx("div", { children: left }), _jsx("div", { children: center }), _jsx("div", { children: right })] })),
    MetricGrid: ({ metrics }) => (_jsx("div", { children: metrics.map((metric) => (_jsxs("div", { children: [_jsx("span", { children: metric.label }), _jsx("span", { children: metric.value })] }, metric.label))) })),
}));
vi.mock("@aa/shared-state", () => ({
    useRestClient: () => mockRestClient,
    useApprovalsQuery: () => ({
        data: [
            { approvalId: "approval-1", taskId: "task-1", riskLevel: "low", reasonSummary: "Routine low risk change" },
            { approvalId: "approval-2", taskId: "task-2", riskLevel: "high", reasonSummary: "High risk deployment" },
        ],
    }),
    usePreferencesQuery: () => ({
        data: {
            locale: "zh-CN",
            theme: "light",
            defaultDashboardLayout: ["health", "queue"],
        },
    }),
    useRolesQuery: () => ({
        data: [{ id: "role-1", name: "Platform SRE", scope: "platform", permissionCount: 12, userCount: 3 }],
    }),
    useFeatureFlagsQuery: () => ({
        data: [{ id: "analytics", enabled: true, rolloutPercentage: 100, target: "all" }],
    }),
    useModelsQuery: () => ({
        data: [{ id: "model-1", provider: "minimax", model: "MiniMax-Text-01", boundDomains: ["platform"], budgetUsd: 50 }],
    }),
    useDomainConfigsQuery: () => ({
        data: [{ id: "platform", displayName: "Platform", owner: "ops", defaultDrillDepth: 3, featureVisibilityCount: 8 }],
    }),
    useTenantsQuery: () => ({
        data: [{ id: "tenant-1", name: "Default Tenant", domains: ["platform"], status: "active" }],
    }),
    useWebhooksQuery: () => ({
        data: [{ id: "webhook-1", targetUrl: "https://hooks.example.test", eventCount: 12, enabled: true }],
    }),
}));
vi.mock("@aa/shared-api-client", () => ({
    approveApproval: mockApproveApproval,
    rejectApproval: mockRejectApproval,
    delegateApproval: mockDelegateApproval,
    requestMoreContextApproval: mockRequestMoreContextApproval,
    createRESTClient: vi.fn().mockReturnValue(mockRestClient),
    updatePreferences: mockUpdatePreferences,
}));
import { ApprovalWebView } from "../../packages/features/approval/src/web";
import { SettingsWebView } from "../../packages/features/settings/src/web";
describe("web app interaction smoke", () => {
    afterEach(() => {
        cleanup();
    });
    it("loads approval view and allows operator decisions", async () => {
        render(_jsx(ApprovalWebView, {}));
        expect(await screen.findByText("Approval Center")).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: /task-2/i }));
        fireEvent.click(screen.getByRole("button", { name: "批准" }));
        expect(mockApproveApproval).toHaveBeenCalledWith(mockRestClient, "approval-2");
    });
    it("loads settings view and persists visible save state", async () => {
        render(_jsx(SettingsWebView, {}));
        expect(await screen.findByText("设置中心")).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: "保存设置" }));
        expect(await screen.findByText(/保存状态: saved/i)).toBeInTheDocument();
    });
});
