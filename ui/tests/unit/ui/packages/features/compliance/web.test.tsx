// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FeatureWorkbenchPanel: ({
    metrics,
    rows,
    items,
  }: {
    metrics: Array<{ label: string; value: string | number }>;
    rows: Array<{ key: string; value: string }>;
    items: Array<{ title: string; description: string }>;
  }) => (
    <div>
      {metrics.map((metric) => <div key={metric.label}>{`${metric.label}: ${metric.value}`}</div>)}
      {rows.map((row) => <div key={row.key}>{`${row.key}: ${row.value}`}</div>)}
      {items.map((item) => <div key={`${item.title}-${item.description}`}>{`${item.title} ${item.description}`}</div>)}
    </div>
  ),
}));

vi.mock("../../../../../../packages/features/compliance/src/hooks", () => ({
  useComplianceVm: () => ({
    metrics: [
      { label: "标准项", value: 6 },
      { label: "审计事件", value: 28 },
      { label: "例外批准率", value: "91%" },
    ],
    rows: [
      { key: "模式", value: "Sarbanes-Oxley / HIPAA / PCI DSS" },
      { key: "字段策略", value: "3 critical policies, 0 pending exceptions" },
      { key: "审计轨迹", value: "compliance.exception.approved @ 2026-06-04T22:12:03.192Z" },
    ],
    items: [
      { title: "Compliance feed", description: "Sarbanes-Oxley is present in the live governance registry." },
      { title: "Contract boundary", description: "Dedicated compliance check execution and report export APIs are still not promoted beyond the governance surfaces." },
    ],
    loading: false,
    loadError: null,
  }),
}));

import { ComplianceWebView } from "../../../../../../packages/features/compliance/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ComplianceWebView", () => {
  it("renders real compliance summary data instead of placeholder actions", () => {
    render(<ComplianceWebView />);

    expect(screen.queryByText(/标准项: 6/)).not.toBeNull();
    expect(screen.queryByText(/模式: Sarbanes-Oxley \/ HIPAA \/ PCI DSS/)).not.toBeNull();
    expect(screen.queryByText(/Contract boundary Dedicated compliance check execution and report export APIs are still not promoted/)).not.toBeNull();
    expect(screen.queryByText(/运行检查/)).toBeNull();
  });
});
