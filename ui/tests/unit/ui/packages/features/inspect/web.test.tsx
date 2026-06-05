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

vi.mock("../../../../../../packages/features/inspect/src/hooks", () => ({
  useInspectVm: () => ({
    metrics: [
      { label: "Tasks", value: 1 },
      { label: "Pending Approvals", value: 0 },
      { label: "Recent Events", value: 2 },
    ],
    listItems: [
      { id: "task-1", title: "Inspect live coding task", subtitle: "failed · coding" },
    ],
    selectedId: "task-1",
    detailRows: [
      { key: "Task", value: "Inspect live coding task" },
      { key: "Execution Trace", value: "trace-123" },
    ],
    summaryItems: [
      { title: "Inspect feed", description: "Inspect live coding task inspect data is loaded from the real task inspect route." },
      { title: "Recovery recommendation", description: "handover_to_operator" },
    ],
    approvalItems: [
      { title: "No approvals", description: "The selected task has no approval records in its inspect snapshot." },
    ],
    eventItems: [
      { title: "workflow.started", description: "2026-06-05T08:10:00.000Z" },
    ],
    loading: false,
    loadError: null,
    selectTask: mockSelectTask,
  }),
}));

import { InspectWebView } from "../../../../../../packages/features/inspect/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InspectWebView", () => {
  it("renders live inspect data and removes placeholder snapshot actions", () => {
    render(<InspectWebView />);

    expect(screen.queryByText(/Tasks: 1/)).not.toBeNull();
    expect(screen.queryByText(/Inspect detail/)).not.toBeNull();
    expect(screen.queryByText(/Execution Trace: trace-123/)).not.toBeNull();
    expect(screen.queryByText(/Recovery recommendation handover_to_operator/)).not.toBeNull();
    expect(screen.queryByText(/抓取快照/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Inspect live coding task/ }));
    expect(mockSelectTask).toHaveBeenCalledWith("task-1");
  });
});
