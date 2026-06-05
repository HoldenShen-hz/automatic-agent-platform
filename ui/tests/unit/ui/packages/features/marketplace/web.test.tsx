// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectPack = vi.fn();

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
    metrics: [
      { label: "Packs", value: 1 },
      { label: "Categories", value: 1 },
    ],
    listItems: [
      { id: "pack-1", title: "Ops Toolkit · 1.0.0", subtitle: "operations" },
    ],
    selectedId: "pack-1",
    selectedPack: {
      id: "pack-1",
      name: "Ops Toolkit",
      version: "1.0.0",
      category: "operations",
    },
    detailRows: [
      { key: "Pack", value: "Ops Toolkit" },
      { key: "Version", value: "1.0.0" },
    ],
    summaryItems: [
      { title: "Catalog feed", description: "Ops Toolkit is visible in the shared marketplace catalog." },
      { title: "Install workflow", description: "Pack install approval remains unavailable until a marketplace mutation route is promoted into the API contract." },
    ],
    loading: false,
    selectPack: mockSelectPack,
  }),
}));

import { MarketplaceWebView } from "../../../../../../packages/features/marketplace/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MarketplaceWebView", () => {
  it("renders live marketplace catalog data and removes placeholder install actions", () => {
    render(<MarketplaceWebView />);

    expect(screen.queryByText(/Packs: 1/)).not.toBeNull();
    expect(screen.queryByText(/Pack detail/)).not.toBeNull();
    expect(screen.queryByText(/Pack: Ops Toolkit/)).not.toBeNull();
    expect(screen.queryByText(/Install workflow Pack install approval remains unavailable/)).not.toBeNull();
    expect(screen.queryByText(/发起安装审批/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Ops Toolkit/ }));
    expect(mockSelectPack).toHaveBeenCalledWith("pack-1");
  });
});
