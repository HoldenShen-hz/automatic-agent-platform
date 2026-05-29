import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mockSelectWorkflow = vi.fn();
const mockCancelWorkflow = vi.fn();
const mockPauseWorkflow = vi.fn();
const mockResumeWorkflow = vi.fn();
const mockRecoverWorkflow = vi.fn();
const mockReleaseWorkflow = vi.fn();
vi.mock("@aa/ui-core", () => ({
    designTokens: {
        color: { border: "#d0d7de" },
        semantic: { color: { surfaceSelected: "#f3f4f6" } },
    },
    FeatureScaffold: ({ children }) => _jsx("div", { children: children }),
    KeyValueTable: ({ rows }) => (_jsx("div", { children: rows.map((row) => _jsx("div", { children: `${row.key}: ${row.value}` }, row.key)) })),
    ListCard: ({ items }) => (_jsx("div", { children: items.map((item) => _jsx("div", { children: `${item.title} ${item.description}` }, `${item.title}-${item.description}`)) })),
}));
vi.mock("../../../../../../packages/features/workflow-cockpit/src/web/dag-viewer", () => ({
    DAGViewer: ({ steps, currentStage }) => (_jsx("div", { children: `DAG ${currentStage} ${steps.length}` })),
}));
vi.mock("../../../../../../packages/features/workflow-cockpit/src/hooks", () => ({
    useWorkflowCockpitVm: () => ({
        listItems: [{ id: "workflow-1", title: "Campaign Launch", subtitle: "running · execute" }],
        selectedWorkflow: {
            id: "workflow-1",
            title: "Campaign Launch",
            status: "running",
            currentStage: "execute",
            owner: "growth-ops",
            steps: [{ id: "s1", title: "Execute launch", phase: "Execute", status: "running" }],
            approvalNodes: [{ nodeId: "ap-1", title: "Risk Review", status: "pending", assignee: "domain-admin" }],
            evidenceRefs: [{ refId: "ev-1", type: "artifact", uri: "artifact://launch", description: "Launch plan" }],
        },
        selectWorkflow: mockSelectWorkflow,
        cancelWorkflow: mockCancelWorkflow,
        pauseWorkflow: mockPauseWorkflow,
        resumeWorkflow: mockResumeWorkflow,
        recoverWorkflow: mockRecoverWorkflow,
        releaseWorkflow: mockReleaseWorkflow,
    }),
}));
import { WorkflowCockpitWebView } from "../../../../../../packages/features/workflow-cockpit/src/web";
afterEach(() => {
    cleanup();
});
describe("WorkflowCockpitWebView", () => {
    it("renders DAG viewer and approval/evidence side data", () => {
        render(_jsx(WorkflowCockpitWebView, {}));
        expect(screen.queryByText("DAG execute 1")).not.toBeNull();
        expect(screen.queryByText(/审批节点: 1/)).not.toBeNull();
        expect(screen.queryByText(/证据引用: 1/)).not.toBeNull();
        expect(screen.queryByText(/Risk Review pending · domain-admin/)).not.toBeNull();
        expect(screen.queryByText(/artifact Launch plan/)).not.toBeNull();
    });
    it("wires cancel/pause/resume/recover/release controls", () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        render(_jsx(WorkflowCockpitWebView, {}));
        fireEvent.click(screen.getAllByRole("button", { name: "取消" })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "暂停" })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "恢复" })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "恢复链路" })[0]);
        fireEvent.click(screen.getAllByRole("button", { name: "发布" })[0]);
        expect(mockCancelWorkflow).toHaveBeenCalled();
        expect(mockPauseWorkflow).toHaveBeenCalled();
        expect(mockResumeWorkflow).toHaveBeenCalled();
        expect(mockRecoverWorkflow).toHaveBeenCalled();
        expect(mockReleaseWorkflow).toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
