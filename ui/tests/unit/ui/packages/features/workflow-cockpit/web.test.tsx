// @vitest-environment jsdom

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
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}: ${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{`${item.title} ${item.description}`}</div>)}</div>
  ),
}));

vi.mock("../../../../../../packages/features/workflow-cockpit/src/web/dag-viewer", () => ({
  DAGViewer: ({ steps, currentStage }: { steps: Array<{ title: string }>; currentStage: string }) => (
    <div>{`DAG ${currentStage} ${steps.length}`}</div>
  ),
}));

vi.mock("../../../../../../packages/features/workflow-cockpit/src/hooks", () => ({
  useWorkflowCockpitVm: () => ({
    listItems: [{ id: "workflow-1", title: "Campaign Launch", subtitle: "paused · waiting_hitl" }],
    selectedWorkflow: {
      id: "workflow-1",
      title: "Campaign Launch",
      status: "paused",
      currentStage: "waiting_hitl",
      owner: "growth-ops",
      steps: [{ id: "s1", title: "Execute launch", phase: "Execute", status: "running" }],
      approvalNodes: [{ nodeId: "ap-1", title: "Risk Review", status: "pending", assignee: "domain-admin" }],
      evidenceRefs: [{ refId: "ev-1", type: "artifact", uri: "artifact://launch", description: "Launch plan" }],
    },
    controls: {
      cancelEnabled: true,
      pauseEnabled: false,
      resumeEnabled: true,
      recoverEnabled: false,
      releaseEnabled: false,
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
    render(<WorkflowCockpitWebView />);

    expect(screen.queryByText("DAG waiting_hitl 1")).not.toBeNull();
    expect(screen.queryByText(/审批节点: 1/)).not.toBeNull();
    expect(screen.queryByText(/证据引用: 1/)).not.toBeNull();
    expect(screen.queryByText(/Risk Review pending · domain-admin/)).not.toBeNull();
    expect(screen.queryByText(/artifact Launch plan/)).not.toBeNull();
  });

  it("wires cancel/pause/resume/recover/release controls", () => {
    render(<WorkflowCockpitWebView />);

    fireEvent.click(screen.getAllByRole("button", { name: "取消" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "恢复" })[0]!);

    expect(mockCancelWorkflow).toHaveBeenCalled();
    expect(mockResumeWorkflow).toHaveBeenCalled();
    expect(mockPauseWorkflow).not.toHaveBeenCalled();
    expect(mockRecoverWorkflow).not.toHaveBeenCalled();
    expect(mockReleaseWorkflow).not.toHaveBeenCalled();
  });

  it("disables actions that are invalid for the selected workflow status", () => {
    render(<WorkflowCockpitWebView />);

    expect(screen.getAllByRole("button", { name: "暂停" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "恢复链路" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "发布" })[0]).toBeDisabled();
  });
});
