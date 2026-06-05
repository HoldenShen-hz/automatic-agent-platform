// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectTask = vi.fn();
const mockReplayTimeline = vi.fn(async () => undefined);
const mockFocusFailure = vi.fn(async () => undefined);
const mockExportDebugSnapshot = vi.fn(async () => undefined);

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Inline: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}: ${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{`${item.title} ${item.description}`}</div>)}</div>
  ),
  MetricGrid: ({ metrics }: { metrics: Array<{ label: string; value: string | number }> }) => (
    <div>{metrics.map((metric) => <div key={metric.label}>{`${metric.label}: ${metric.value}`}</div>)}</div>
  ),
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ThreePaneLayout: ({ left, center, right }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode }) => (
    <div>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  ),
}));

vi.mock("../../../../../../packages/features/workflow-debugger/src/hooks", () => ({
  useWorkflowDebuggerVm: () => ({
    loading: false,
    selectedId: "task-1",
    selectedTask: {
      id: "task-1",
      title: "Replay failed coding task",
      status: "failed",
      domainId: "coding",
      currentStep: "real_model",
    },
    tasks: [],
    listItems: [{ id: "task-1", title: "Replay failed coding task", subtitle: "failed · coding" }],
    detailRows: [{ key: "Status", value: "failed" }],
    metrics: [{ label: "Tasks", value: 1 }],
    activityItems: [{ title: "Debug snapshot exported", description: "Live task inspect snapshot captured." }],
    activePanel: "timeline",
    timelineItems: [{ title: "workflow:step_started", description: "2026-06-05T00:01:00.000Z · Real model execution started" }],
    failureItems: [{ title: "MiniMax overload", description: "minimax · 2026-06-05T00:02:00.000Z" }],
    exportSnapshot: "{\"task\":{}}",
    loadError: null,
    pendingOperations: 0,
    selectTask: mockSelectTask,
    replayTimeline: mockReplayTimeline,
    focusFailure: mockFocusFailure,
    exportDebugSnapshot: mockExportDebugSnapshot,
  }),
}));

import { WorkflowDebuggerWebView } from "../../../../../../packages/features/workflow-debugger/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkflowDebuggerWebView", () => {
  it("renders live debugger state and wires debugger actions", () => {
    render(<WorkflowDebuggerWebView />);

    expect(screen.queryByText(/Recent tasks/)).not.toBeNull();
    expect(screen.queryByText(/Status: failed/)).not.toBeNull();
    expect(screen.queryByText(/workflow:step_started 2026-06-05T00:01:00.000Z/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Replay failed coding task/ }));
    fireEvent.click(screen.getByRole("button", { name: "回放时间线" }));
    fireEvent.click(screen.getByRole("button", { name: "定位失败阶段" }));
    fireEvent.click(screen.getByRole("button", { name: "导出调试快照" }));

    expect(mockSelectTask).toHaveBeenCalledWith("task-1");
    expect(mockReplayTimeline).toHaveBeenCalled();
    expect(mockFocusFailure).toHaveBeenCalled();
    expect(mockExportDebugSnapshot).toHaveBeenCalled();
  });
});
