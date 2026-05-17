import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRestClient } = vi.hoisted(() => ({
  mockRestClient: {},
}));

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  KeyValueTable: ({ rows }: { rows: readonly { key: string; value: string }[] }) => (
    <dl>
      {rows.map((row) => (
        <div key={row.key}>
          <dt>{row.key}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
  ListCard: ({ items }: { items: readonly { title: string; description: string }[] }) => (
    <ul>
      {items.map((item) => (
        <li key={item.title}>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </li>
      ))}
    </ul>
  ),
  ThreePaneLayout: ({ left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode }) => (
    <div>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  ),
  MetricGrid: ({ metrics }: { metrics: readonly { label: string; value: string | number }[] }) => (
    <div>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <span>{metric.label}</span>
          <span>{metric.value}</span>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mockRestClient,
  useApprovalsQuery: () => ({
    data: [
      { approvalId: "approval-1", taskId: "task-1", riskLevel: "low", reasonSummary: "Routine low risk change" },
      { approvalId: "approval-2", taskId: "task-2", riskLevel: "high", reasonSummary: "High risk deployment" },
    ],
  }),
  usePreferencesQuery: () => ({
    data: {
      locale: "zh-CN",
      theme: "light",
      defaultDashboardLayout: ["health", "queue"],
    },
  }),
  useRolesQuery: () => ({
    data: [{ id: "role-1", name: "Platform SRE", scope: "platform", permissionCount: 12, userCount: 3 }],
  }),
  useFeatureFlagsQuery: () => ({
    data: [{ id: "analytics", enabled: true, rolloutPercentage: 100, target: "all" }],
  }),
  useModelsQuery: () => ({
    data: [{ id: "model-1", provider: "minimax", model: "MiniMax-Text-01", boundDomains: ["platform"], budgetUsd: 50 }],
  }),
  useDomainConfigsQuery: () => ({
    data: [{ id: "platform", displayName: "Platform", owner: "ops", defaultDrillDepth: 3, featureVisibilityCount: 8 }],
  }),
  useTenantsQuery: () => ({
    data: [{ id: "tenant-1", name: "Default Tenant", domains: ["platform"], status: "active" }],
  }),
  useWebhooksQuery: () => ({
    data: [{ id: "webhook-1", targetUrl: "https://hooks.example.test", eventCount: 12, enabled: true }],
  }),
}));

vi.mock("@aa/shared-api-client", () => ({
  approveApproval: vi.fn().mockResolvedValue(undefined),
  rejectApproval: vi.fn().mockResolvedValue(undefined),
  delegateApproval: vi.fn().mockResolvedValue(undefined),
  requestMoreContextApproval: vi.fn().mockResolvedValue(undefined),
  createRESTClient: vi.fn().mockReturnValue(mockRestClient),
  updatePreferences: vi.fn().mockResolvedValue(undefined),
}));

import { ApprovalWebView } from "../../packages/features/approval/src/web";
import { SettingsWebView } from "../../packages/features/settings/src/web";

describe("web app interaction smoke", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads approval view and allows operator decisions", async () => {
    render(<ApprovalWebView />);

    expect(await screen.findByText("Approval Center")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /task-2/i }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });

  it("loads settings view and persists visible save state", async () => {
    render(<SettingsWebView />);

    expect(await screen.findByText("设置中心")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "保存设置" }));
    expect(await screen.findByText(/保存状态: saved/i)).toBeInTheDocument();
  });
});
