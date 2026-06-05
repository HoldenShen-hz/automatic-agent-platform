// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectPolicy = vi.fn();

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

vi.mock("../../../../../../packages/features/policy/src/hooks", () => ({
  usePolicyVm: () => ({
    metrics: [
      { label: "Policies", value: 2 },
      { label: "Critical", value: 1 },
      { label: "Pending Exceptions", value: 1 },
    ],
    listItems: [
      { id: "sox", title: "Sarbanes-Oxley · critical", subtitle: "1 pending exceptions" },
    ],
    selectedId: "sox",
    detailRows: [
      { key: "Policy", value: "Sarbanes-Oxley" },
      { key: "Severity", value: "critical" },
    ],
    summaryItems: [
      { title: "Governance feed", description: "Sarbanes-Oxley is loaded from the real governance policy registry." },
      { title: "Contract boundary", description: "Policy simulate, publish, and rollback workflows still need dedicated policy-control API routes." },
    ],
    exceptionItems: [
      { title: "Temporary bypass · pending", description: "exc-1" },
    ],
    loading: false,
    loadError: null,
    selectPolicy: mockSelectPolicy,
  }),
}));

import { PolicyWebView } from "../../../../../../packages/features/policy/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PolicyWebView", () => {
  it("renders backend policy state and removes placeholder control actions", () => {
    render(<PolicyWebView />);

    expect(screen.queryByText(/Policies: 2/)).not.toBeNull();
    expect(screen.queryByText(/Policy detail/)).not.toBeNull();
    expect(screen.queryByText(/Policy: Sarbanes-Oxley/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Policy simulate, publish, and rollback workflows still need/)).not.toBeNull();
    expect(screen.queryByText(/模拟策略命中/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Sarbanes-Oxley/ }));
    expect(mockSelectPolicy).toHaveBeenCalledWith("sox");
  });
});
