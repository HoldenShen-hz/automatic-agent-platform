// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectReport = vi.fn();

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

vi.mock("../../../../../../packages/features/cost-center/src/hooks", () => ({
  useCostCenterVm: () => ({
    metrics: [
      { label: "Reports", value: 1 },
      { label: "Spend", value: "$120.00" },
      { label: "Budget", value: "$200.00" },
    ],
    listItems: [
      { id: "cost-1", title: "frontend · $120.00", subtitle: "Budget $200.00" },
    ],
    selectedId: "cost-1",
    selectedReport: {
      id: "cost-1",
      scope: "frontend",
      amountUsd: 120,
      budgetUsd: 200,
    },
    detailRows: [
      { key: "Scope", value: "frontend" },
      { key: "Variance", value: "$-80.00" },
    ],
    summaryItems: [
      { title: "Budget feed", description: "frontend is currently reporting against the shared backend cost feed." },
      { title: "Contract boundary", description: "Budget refresh, drilldown mutation, and export workflow still require promoted cost-control API endpoints." },
    ],
    loading: false,
    selectReport: mockSelectReport,
  }),
}));

import { CostCenterWebView } from "../../../../../../packages/features/cost-center/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CostCenterWebView", () => {
  it("renders backend cost reports and hides placeholder export actions", () => {
    render(<CostCenterWebView />);

    expect(screen.queryByText(/Reports: 1/)).not.toBeNull();
    expect(screen.queryByText(/Cost detail/)).not.toBeNull();
    expect(screen.queryByText("Variance: $-80.00")).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Budget refresh, drilldown mutation, and export workflow still require/)).not.toBeNull();
    expect(screen.queryByText(/导出成本报表/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /frontend/ }));
    expect(mockSelectReport).toHaveBeenCalledWith("cost-1");
  });
});
