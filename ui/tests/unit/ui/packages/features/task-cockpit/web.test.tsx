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
}), { virtual: true });

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
    render(<TaskCockpitWebView />);

    expect(screen.queryByText(/L3 Steps/)).not.toBeNull();
    expect(screen.queryByText(/Collect inputs completed · agent-1/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "L4 Evidence" }));
    expect(screen.queryByText(/artifact Approval packet/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "L5 Timeline" }));
    expect(screen.queryByText(/Escalated Escalated to domain-admin/)).not.toBeNull();
  });

  it("wires takeover, pause, cancel, retry, resume, and escalate controls", () => {
    render(<TaskCockpitWebView />);

    fireEvent.click(screen.getAllByRole("button", { name: "Take Over" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Supervised Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Escalate" }));

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
    render(<TaskCockpitWebView />);

    fireEvent.change(screen.getAllByPlaceholderText("e.g. platform-sre")[0]!, {
      target: { value: "ops<script>" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("e.g. domain-admin")[0]!, {
      target: { value: "domain-admin!!" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Take Over" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Escalate" }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockClaimTask).toHaveBeenCalledWith("opsscript");
    expect(mockEscalateTask).toHaveBeenCalledWith("domain-admin");
  });
});
