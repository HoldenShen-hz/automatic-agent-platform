// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectAgent = vi.fn();

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

vi.mock("../../../../../../packages/features/agent-manager/src/hooks", () => ({
  useAgentManagerVm: () => ({
    metrics: [
      { label: "Agents", value: 2 },
      { label: "Healthy", value: 1 },
    ],
    listItems: [
      { id: "agent-1", title: "default-worker · healthy", subtitle: "default / load 10%" },
      { id: "agent-2", title: "ui-worker-busy-1 · offline", subtitle: "frontend / load 0%" },
    ],
    selectedId: "agent-1",
    selectedAgent: {
      id: "agent-1",
      name: "default-worker",
      status: "healthy",
      domainId: "default",
      load: 0.1,
    },
    detailRows: [
      { key: "Agent", value: "default-worker" },
      { key: "Status", value: "healthy" },
    ],
    summaryItems: [
      { title: "Live supervisor feed", description: "default-worker is currently healthy on default." },
      { title: "Mutation policy", description: "Isolation and remediation remain blocked until a dedicated agent-control backend contract is added." },
    ],
    loading: false,
    selectAgent: mockSelectAgent,
  }),
}));

import { AgentManagerWebView } from "../../../../../../packages/features/agent-manager/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AgentManagerWebView", () => {
  it("renders live agent data and selection controls without fake actions", () => {
    render(<AgentManagerWebView />);

    expect(screen.queryByText(/Agents: 2/)).not.toBeNull();
    expect(screen.queryByText(/Agent detail/)).not.toBeNull();
    expect(screen.queryByText(/Agent: default-worker/)).not.toBeNull();
    expect(screen.queryByText(/Mutation policy Isolation and remediation remain blocked/)).not.toBeNull();
    expect(screen.queryByText(/预览安装影响/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ui-worker-busy-1/ }));
    expect(mockSelectAgent).toHaveBeenCalledWith("agent-2");
  });
});
