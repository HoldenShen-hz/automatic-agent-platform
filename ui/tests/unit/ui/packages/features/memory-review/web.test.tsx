// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectItem = vi.fn();

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

vi.mock("../../../../../../packages/features/memory-review/src/hooks", () => ({
  useMemoryReviewVm: () => ({
    metrics: [
      { label: "Knowledge Items", value: 2 },
      { label: "Playbooks", value: 1 },
      { label: "Artifacts", value: 1 },
    ],
    listItems: [
      { id: "kb-1", title: "Operator Recovery Playbook", subtitle: "playbook · 2026-06-05T08:00:00.000Z" },
    ],
    selectedId: "kb-1",
    detailRows: [
      { key: "Knowledge Item", value: "Operator Recovery Playbook" },
      { key: "Kind", value: "playbook" },
    ],
    summaryItems: [
      { title: "Knowledge feed", description: "Operator Recovery Playbook is loaded from the real knowledge inventory." },
      { title: "Review boundary", description: "Memory approve, revoke, and audit export flows still need dedicated memory-governance mutation APIs." },
    ],
    lineageItems: [
      { title: "playbook lineage", description: "kb-1 updated at 2026-06-05T08:00:00.000Z" },
    ],
    loading: false,
    loadError: null,
    selectItem: mockSelectItem,
  }),
}));

import { MemoryReviewWebView } from "../../../../../../packages/features/memory-review/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MemoryReviewWebView", () => {
  it("renders real knowledge inventory state and removes placeholder review actions", () => {
    render(<MemoryReviewWebView />);

    expect(screen.queryByText(/Knowledge Items: 2/)).not.toBeNull();
    expect(screen.queryByText(/Memory detail/)).not.toBeNull();
    expect(screen.queryByText(/Knowledge Item: Operator Recovery Playbook/)).not.toBeNull();
    expect(screen.queryByText(/Review boundary Memory approve, revoke, and audit export flows still need/)).not.toBeNull();
    expect(screen.queryByText(/批准提案/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Operator Recovery Playbook/ }));
    expect(mockSelectItem).toHaveBeenCalledWith("kb-1");
  });
});
