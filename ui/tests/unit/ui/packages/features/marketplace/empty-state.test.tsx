// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../../../../../packages/features/marketplace/src/hooks", () => ({
  useMarketplaceVm: () => ({
    metrics: [],
    listItems: [],
    selectedId: null,
    selectedPack: null,
    detailRows: [],
    summaryItems: [],
    loading: false,
    selectPack: vi.fn(),
  }),
}));

import { MarketplaceWebView } from "../../../../../../packages/features/marketplace/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MarketplaceWebView empty state", () => {
  it("shows backend-empty messaging in both list and detail panes", () => {
    render(<MarketplaceWebView />);

    expect(screen.getAllByText("No marketplace packs published by the backend.")).toHaveLength(2);
    expect(screen.queryByText("No pack selected")).toBeNull();
  });
});
