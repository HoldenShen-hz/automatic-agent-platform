import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockSelectTask = vi.fn();
const mockClaimTask = vi.fn();
const mockResumeTask = vi.fn();
const mockEscalateTask = vi.fn();

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}: ${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{`${item.title} ${item.description}`}</div>)}</div>
  ),
  ThreePaneLayout: ({ left, center, right }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode }) => (
    <div>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  ),
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
    },
    selectTask: mockSelectTask,
    claimTask: mockClaimTask,
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

describe("TaskCockpitWebView", () => {
  it("renders L3-L5 drill-down tabs and their content", () => {
    render(<TaskCockpitWebView />);

    expect(screen.getByText(/L3 Steps/)).toBeInTheDocument();
    expect(screen.getByText(/Collect inputs completed · agent-1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "L4 Evidence" }));
    expect(screen.getByText(/artifact Approval packet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "L5 Timeline" }));
    expect(screen.getByText(/Escalated Escalated to domain-admin/)).toBeInTheDocument();
  });

  it("wires takeover, resume, and escalate controls", () => {
    render(<TaskCockpitWebView />);

    fireEvent.click(screen.getByRole("button", { name: "Take Over" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Supervised Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Escalate" }));

    expect(mockClaimTask).toHaveBeenCalled();
    expect(mockResumeTask).toHaveBeenCalledWith("normal");
    expect(mockResumeTask).toHaveBeenCalledWith("supervised");
    expect(mockEscalateTask).toHaveBeenCalled();
  });
});
