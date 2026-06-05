// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectExplanation = vi.fn();

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

vi.mock("../../../../../../packages/features/explainability/src/hooks", () => ({
  useExplainabilityVm: () => ({
    metrics: [
      { label: "Explanations", value: 1 },
      { label: "Evidence", value: 3 },
    ],
    listItems: [
      { id: "exp-1", title: "Platform health summary", subtitle: "3 evidence" },
    ],
    selectedId: "exp-1",
    selectedExplanation: {
      id: "exp-1",
      title: "Platform health summary",
      evidenceCount: 3,
      summary: "tier1_ack_backlog_degraded",
    },
    detailRows: [
      { key: "Explanation", value: "Platform health summary" },
      { key: "Summary", value: "tier1_ack_backlog_degraded" },
    ],
    summaryItems: [
      { title: "Live explanation feed", description: "tier1_ack_backlog_degraded" },
      { title: "Contract boundary", description: "Causal-chain expansion and evidence pinning still require a dedicated explainability mutation contract." },
    ],
    loading: false,
    selectExplanation: mockSelectExplanation,
  }),
}));

import { ExplainabilityWebView } from "../../../../../../packages/features/explainability/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExplainabilityWebView", () => {
  it("renders backend explanation summaries and selection state", () => {
    render(<ExplainabilityWebView />);

    expect(screen.queryByText(/Explanations: 1/)).not.toBeNull();
    expect(screen.queryByText(/Explanation detail/)).not.toBeNull();
    expect(screen.queryByText(/Summary: tier1_ack_backlog_degraded/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Causal-chain expansion and evidence pinning still require/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Platform health summary/ }));
    expect(mockSelectExplanation).toHaveBeenCalledWith("exp-1");
  });
});
