// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectEntry = vi.fn();

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

vi.mock("../../../../../../packages/features/audit/src/hooks", () => ({
  useAuditVm: () => ({
    metrics: [
      { label: "Entries", value: 3 },
      { label: "Actors", value: 2 },
      { label: "Resources", value: 2 },
    ],
    listItems: [
      { id: "log-1", title: "compliance.policy.updated · updated", subtitle: "local-dev-operator · 2026-06-05T08:00:00.000Z" },
    ],
    selectedId: "log-1",
    detailRows: [
      { key: "Action", value: "compliance.policy.updated" },
      { key: "Outcome", value: "updated" },
    ],
    summaryItems: [
      { title: "Audit feed", description: "compliance.policy.updated was recorded for compliance-policy:sox." },
      { title: "Contract boundary", description: "Evidence export bundles and actor-trace pivot routes still need dedicated audit API contracts." },
    ],
    metadataItems: [
      { title: "policyId", description: "sox" },
    ],
    loading: false,
    loadError: null,
    selectEntry: mockSelectEntry,
  }),
}));

import { AuditWebView } from "../../../../../../packages/features/audit/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuditWebView", () => {
  it("renders backend audit entries and removes placeholder export actions", () => {
    render(<AuditWebView />);

    expect(screen.queryByText(/Entries: 3/)).not.toBeNull();
    expect(screen.queryByText(/Audit detail/)).not.toBeNull();
    expect(screen.queryByText(/Action: compliance.policy.updated/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Evidence export bundles and actor-trace pivot routes still need/)).not.toBeNull();
    expect(screen.queryByText(/导出证据包/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /compliance.policy.updated/ }));
    expect(mockSelectEntry).toHaveBeenCalledWith("log-1");
  });
});
