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

vi.mock("../../../../../../packages/features/trace-explorer/src/hooks", () => ({
  useTraceExplorerVm: () => ({
    metrics: [
      { label: "Tasks", value: 1 },
      { label: "Timeline Events", value: 2 },
      { label: "Restricted Signals", value: 1 },
    ],
    listItems: [
      { id: "task-1", title: "Trace selected task", subtitle: "completed · platform" },
    ],
    selectedId: "task-1",
    detailRows: [
      { key: "Trace ID", value: "trace-abc" },
      { key: "Artifacts", value: "2" },
    ],
    summaryItems: [
      { title: "Trace feed", description: "Trace selected task timeline is loaded from the real task trace route." },
      { title: "Contract boundary", description: "Trace export bundles and restricted-event pivot APIs still need dedicated observability routes." },
    ],
    timelineItems: [
      { title: "workflow.started", description: "2026-06-05T08:30:00.000Z · started" },
    ],
    restrictedItems: [
      { title: "policy.denied", description: "2026-06-05T08:31:00.000Z · restricted action blocked" },
    ],
    loading: false,
    loadError: null,
    selectTask: mockSelectTask,
  }),
}));

import { TraceExplorerWebView } from "../../../../../../packages/features/trace-explorer/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TraceExplorerWebView", () => {
  it("renders real trace timeline views and removes placeholder trace actions", () => {
    render(<TraceExplorerWebView />);

    expect(screen.queryByText(/Timeline Events: 2/)).not.toBeNull();
    expect(screen.queryByText(/Trace detail/)).not.toBeNull();
    expect(screen.queryByText(/Trace ID: trace-abc/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Trace export bundles and restricted-event pivot APIs still need/)).not.toBeNull();
    expect(screen.queryByText(/打开 Trace/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Trace selected task/ }));
    expect(mockSelectTask).toHaveBeenCalledWith("task-1");
  });
});
