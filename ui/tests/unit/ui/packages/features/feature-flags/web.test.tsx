// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FeatureWorkbenchPanel: ({
    metrics,
    items,
    emptyState,
  }: {
    metrics: Array<{ label: string; value: string | number }>;
    items: Array<{ id: string; title: string; description: string }>;
    emptyState?: string;
  }) => (
    <div>
      {metrics.map((metric) => <div key={metric.label}>{`${metric.label}: ${metric.value}`}</div>)}
      {items.length === 0 ? <div>{emptyState}</div> : items.map((item) => <div key={item.id}>{`${item.title} ${item.description}`}</div>)}
    </div>
  ),
}));

vi.mock("../../../../../../packages/features/feature-flags/src/hooks", () => ({
  useFeatureFlagsVm: () => ({
    isLoading: false,
    flags: [
      {
        id: "beta-dashboard",
        enabled: true,
        rolloutPercentage: 25,
        target: "ops-users",
      },
    ],
    metrics: [
      { label: "Total Flags", value: 1 },
      { label: "Enabled", value: 1 },
      { label: "Disabled", value: 0 },
    ],
    items: [
      {
        id: "beta-dashboard",
        title: "beta-dashboard",
        description: "enabled · rollout 25% · ops-users",
        detailRows: [],
      },
    ],
  }),
}));

import { FeatureFlagsWebView } from "../../../../../../packages/features/feature-flags/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FeatureFlagsWebView", () => {
  it("renders the read-only backend inventory boundary", () => {
    render(<FeatureFlagsWebView />);

    expect(screen.queryByText("Total Flags: 1")).not.toBeNull();
    expect(screen.queryByText(/beta-dashboard enabled · rollout 25% · ops-users/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary|契约边界/)).not.toBeNull();
    expect(screen.queryByText(/read-only feature flag inventory|只读功能开关清单|只读功能开关/i)).not.toBeNull();
  });
});
