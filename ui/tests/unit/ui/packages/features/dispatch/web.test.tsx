// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectTask = vi.fn();

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock("../../../../../../packages/features/dispatch/src/hooks", () => ({
  useDispatchVm: () => ({
    metrics: [
      { label: "Tasks", value: 3 },
      { label: "Running Tasks", value: 1 },
      { label: "Running Workflows", value: 1 },
    ],
    listItems: [
      { id: "task-1", title: "Dispatch live task", subtitle: "running · platform" },
    ],
    selectedId: "task-1",
    detailRows: [
      { key: "Latest Dispatch Outcome", value: "accepted" },
      { key: "Worker Placement", value: "local" },
    ],
    summaryItems: [
      { title: "Dispatch feed", description: "Dispatch live task dispatch view is loaded from real task and inspect APIs." },
      { title: "Contract boundary", description: "Manual dispatch, priority reordering, and operator escalation still need dedicated dispatch mutation APIs." },
    ],
    workflowItems: [
      { title: "Main workflow · running", description: "stage-2 · runtime" },
    ],
    approvalItems: [
      { title: "No approvals", description: "The selected task has no dispatch-related approval records." },
    ],
    loading: false,
    loadError: null,
    selectTask: mockSelectTask,
  }),
}));

import { DispatchWebView } from "../../../../../../packages/features/dispatch/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DispatchWebView", () => {
  it("renders real dispatch inspection data and removes placeholder mutation actions", () => {
    render(<DispatchWebView />);

    expect(screen.queryByText(/Running Tasks: 1/)).not.toBeNull();
    expect(screen.queryByText(/Dispatch detail/)).not.toBeNull();
    expect(screen.queryByText(/Worker Placement: local/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Manual dispatch, priority reordering, and operator escalation still need/)).not.toBeNull();
    expect(screen.queryByText(/立即派发/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Dispatch live task/ }));
    expect(mockSelectTask).toHaveBeenCalledWith("task-1");
  });
});
