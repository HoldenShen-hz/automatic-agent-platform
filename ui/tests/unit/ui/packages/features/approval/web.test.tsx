import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockApprove = vi.fn(async () => undefined);
const mockReject = vi.fn(async () => undefined);
const mockDelegate = vi.fn(async () => undefined);
const mockRequestMoreContext = vi.fn(async () => undefined);
const mockSelectApproval = vi.fn();

vi.mock("@aa/ui-core", () => ({
  designTokens: {
    color: { border: "#d0d7de" },
    semantic: { color: { surfaceSelected: "#f3f4f6" } },
  },
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>
      {rows.map((row) => (
        <div key={row.key}>{`${row.key}: ${row.value}`}</div>
      ))}
    </div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={item.title}>{item.title}</div>)}</div>
  ),
  ThreePaneLayout: ({ left, center, right }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode }) => (
    <div>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  ),
}));

vi.mock("../../../../../../packages/features/approval/src/hooks", () => ({
  useApprovalCenterVm: () => ({
    approvals: [],
    queueItems: [
      { id: "approval-1", title: "task-1", subtitle: "critical" },
    ],
    selectedId: "approval-1",
    selectedApproval: {
      approvalId: "approval-1",
      taskId: "task-1",
      riskLevel: "critical",
      reasonSummary: "Production rollout",
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      policySource: "domain-policy",
      recommendedOption: "approve",
    },
    actionHistory: [],
    queueDepth: 1,
    pendingAction: false,
    selectApproval: mockSelectApproval,
    approve: mockApprove,
    reject: mockReject,
    delegate: mockDelegate,
    requestMoreContext: mockRequestMoreContext,
  }),
}));

import { ApprovalWebView } from "../../../../../../packages/features/approval/src/web";

describe("ApprovalWebView", () => {
  it("renders deadline, policy source, and recommended option", () => {
    render(<ApprovalWebView />);

    expect(screen.getByText(/Deadline:/)).toBeInTheDocument();
    expect(screen.getByText(/Policy Source: domain-policy/)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Option: approve/)).toBeInTheDocument();
  });

  it("supports request-context and decision actions", () => {
    render(<ApprovalWebView />);

    fireEvent.click(screen.getByRole("button", { name: "批准" }));
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));
    fireEvent.click(screen.getByRole("button", { name: "请求上下文" }));

    expect(mockApprove).toHaveBeenCalled();
    expect(mockReject).toHaveBeenCalled();
    expect(mockRequestMoreContext).toHaveBeenCalled();
  });
});
