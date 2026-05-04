import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockSelectWorkflow = vi.fn();
const mockPauseWorkflow = vi.fn();
const mockResumeWorkflow = vi.fn();
const mockRecoverWorkflow = vi.fn();
const mockReleaseWorkflow = vi.fn();

vi.mock("@aa/ui-core", () => ({
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
    pauseWorkflow: mockPauseWorkflow,
    resumeWorkflow: mockResumeWorkflow,
    recoverWorkflow: mockRecoverWorkflow,
    releaseWorkflow: mockReleaseWorkflow,
  }),
}));

import { WorkflowCockpitWebView } from "../../../../../../packages/features/workflow-cockpit/src/web";

describe("WorkflowCockpitWebView", () => {
  it("renders DAG viewer and approval/evidence side data", () => {
    render(<WorkflowCockpitWebView />);

    expect(screen.getByText("DAG execute 1")).toBeInTheDocument();
    expect(screen.getByText(/Approval Nodes: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Evidence Refs: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Risk Review pending · domain-admin/)).toBeInTheDocument();
    expect(screen.getByText(/artifact Launch plan/)).toBeInTheDocument();
  });

  it("wires pause/resume/recover/release controls", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WorkflowCockpitWebView />);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Recover" }));
    fireEvent.click(screen.getByRole("button", { name: "Release" }));

    expect(mockPauseWorkflow).toHaveBeenCalled();
    expect(mockResumeWorkflow).toHaveBeenCalled();
    expect(mockRecoverWorkflow).toHaveBeenCalled();
    expect(mockReleaseWorkflow).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
