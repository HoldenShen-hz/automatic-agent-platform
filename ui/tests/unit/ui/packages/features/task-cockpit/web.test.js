import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mockSelectTask = vi.fn();
const mockClaimTask = vi.fn();
const mockPauseTask = vi.fn();
const mockCancelTask = vi.fn();
const mockRetryTask = vi.fn();
const mockResumeTask = vi.fn();
const mockEscalateTask = vi.fn();
vi.mock("@aa/ui-core", () => ({
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    KeyValueTable: ({ rows }) => (_jsx("div", { children: rows.map((row) => _jsx("div", { children: `${row.key}: ${row.value}` }, row.key)) })),
    ListCard: ({ items }) => (_jsx("div", { children: items.map((item) => _jsx("div", { children: `${item.title} ${item.description}` }, `${item.title}-${item.description}`)) })),
    ThreePaneLayout: ({ left, center, right }) => (_jsxs("div", { children: [_jsx("div", { children: left }), _jsx("div", { children: center }), _jsx("div", { children: right })] })),
}));
vi.mock("../../../../../../packages/features/task-cockpit/src/hooks", () => ({
    useTaskCockpitVm: () => ({
        listItems: [{ id: "task-1", title: "Spring campaign", subtitle: "blocked · marketing" }],
        selectedTask: {
            id: "task-1",
            title: "Spring campaign",
            status: "blocked",
            owner: "growth-ops",
            currentStep: "review",
            domainId: "marketing",
            evidenceCount: 2,
            timelineDepth: 5,
            resourceUsage: {
                cpuPercent: 62,
                memoryMb: 768,
                runtimeMinutes: 18,
            },
        },
        selectTask: mockSelectTask,
        claimTask: mockClaimTask,
        pauseTask: mockPauseTask,
        cancelTask: mockCancelTask,
        retryTask: mockRetryTask,
        resumeTask: mockResumeTask,
        escalateTask: mockEscalateTask,
        stepViewer: {
            steps: [{ id: "s1", title: "Collect inputs", status: "completed", executor: "agent-1" }],
            selectedStep: null,
            stepOutputs: [],
            selectStep: vi.fn(),
        },
        evidenceViewer: {
            evidenceChain: [{ id: "e1", type: "artifact", description: "Approval packet" }],
            loading: false,
        },
        timelineViewer: {
            timelineEvents: [{ id: "t1", title: "Escalated", description: "Escalated to domain-admin" }],
            expandedEventId: null,
            expandEvent: vi.fn(),
        },
        timelineItems: [],
    }),
}));
import { TaskCockpitWebView } from "../../../../../../packages/features/task-cockpit/src/web";
afterEach(() => {
    cleanup();
});
describe("TaskCockpitWebView", () => {
    it("renders L3-L5 drill-down tabs and their content", () => {
        render(_jsx(TaskCockpitWebView, {}));
        expect(screen.queryByText(/L3 步骤/)).not.toBeNull();
        expect(screen.queryByText(/CPU: 62%/)).not.toBeNull();
        expect(screen.queryByText(/Memory: 768 MB/)).not.toBeNull();
        expect(screen.queryByText(/Collect inputs completed · agent-1/)).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "L4 证据" }));
        expect(screen.queryByText(/artifact Approval packet/)).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "L5 时间线" }));
        expect(screen.queryByText(/Escalated Escalated to domain-admin/)).not.toBeNull();
    });
    it("wires takeover, pause, cancel, retry, resume, and escalate controls", () => {
        render(_jsx(TaskCockpitWebView, {}));
        fireEvent.click(screen.getAllByRole("button", { name: "接管" })[0]);
        fireEvent.click(screen.getByRole("button", { name: "暂停" }));
        fireEvent.click(screen.getByRole("button", { name: "取消" }));
        fireEvent.click(screen.getByRole("button", { name: "重试" }));
        fireEvent.click(screen.getByRole("button", { name: "恢复" }));
        fireEvent.click(screen.getByRole("button", { name: "受监督恢复" }));
        fireEvent.click(screen.getByRole("button", { name: "升级" }));
        expect(mockClaimTask).toHaveBeenCalled();
        expect(mockPauseTask).toHaveBeenCalled();
        expect(mockCancelTask).toHaveBeenCalled();
        expect(mockRetryTask).toHaveBeenCalled();
        expect(mockResumeTask).toHaveBeenCalledWith("normal");
        expect(mockResumeTask).toHaveBeenCalledWith("supervised");
        expect(mockEscalateTask).toHaveBeenCalled();
    });
    it("sanitizes operator and escalation target inputs before invoking actions", () => {
        const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
        render(_jsx(TaskCockpitWebView, {}));
        fireEvent.change(screen.getAllByPlaceholderText("例如 platform-sre")[0], {
            target: { value: "ops<script>" },
        });
        fireEvent.change(screen.getAllByPlaceholderText("例如 domain-admin")[0], {
            target: { value: "domain-admin!!" },
        });
        fireEvent.click(screen.getAllByRole("button", { name: "接管" })[0]);
        fireEvent.click(screen.getByRole("button", { name: "升级" }));
        expect(alertSpy).not.toHaveBeenCalled();
        expect(mockClaimTask).toHaveBeenCalledWith("opsscript");
        expect(mockEscalateTask).toHaveBeenCalledWith("domain-admin");
    });
});
