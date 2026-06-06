import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApprove = vi.fn(async () => undefined);
const mockReject = vi.fn(async () => undefined);
const mockDelegate = vi.fn(async () => undefined);
const mockRequestMoreContext = vi.fn(async () => undefined);
const mockSelectApproval = vi.fn();
let mockVm = {
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
    escalationTarget: "risk-lead",
  },
  actionHistory: [],
  queueDepth: 1,
  pendingAction: false,
  selectApproval: mockSelectApproval,
  approve: mockApprove,
  reject: mockReject,
  delegate: mockDelegate,
  requestMoreContext: mockRequestMoreContext,
};

vi.mock("@aa/ui-core", async () => {
  const actual = await vi.importActual<typeof import("@aa/ui-core")>("@aa/ui-core");
  return {
    ...actual,
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
  };
});

vi.mock("../../../../../../packages/features/approval/src/hooks", () => ({
  useApprovalCenterVm: () => mockVm,
}));

import { ApprovalWebView } from "../../../../../../packages/features/approval/src/web";

describe("ApprovalWebView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    mockVm = {
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
        escalationTarget: "risk-lead",
      },
      actionHistory: [],
      queueDepth: 1,
      pendingAction: false,
      selectApproval: mockSelectApproval,
      approve: mockApprove,
      reject: mockReject,
      delegate: mockDelegate,
      requestMoreContext: mockRequestMoreContext,
    };
  });

  it("renders deadline, policy source, and recommended option", () => {
    render(<ApprovalWebView />);

    expect(screen.getByText(/截止时间:/)).toBeInTheDocument();
    expect(screen.getByText(/策略来源: domain-policy/)).toBeInTheDocument();
    expect(screen.getByText(/推荐选项: approve/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "委派目标" })).toHaveValue("risk-lead");
  });

  it("supports request-context and decision actions", () => {
    render(<ApprovalWebView />);

    const approveButton = screen.getByRole("button", { name: "批准" });
    const rejectButton = screen.getByRole("button", { name: "拒绝" });
    const contextButton = screen.getByRole("button", { name: "请求上下文" });

    fireEvent.pointerDown(approveButton);
    fireEvent.click(approveButton);
    fireEvent.pointerDown(rejectButton);
    fireEvent.click(rejectButton);
    fireEvent.pointerDown(contextButton);
    fireEvent.click(contextButton);

    expect(mockApprove).toHaveBeenCalled();
    expect(mockReject).toHaveBeenCalled();
    expect(mockRequestMoreContext).toHaveBeenCalled();
  });

  it("shows backend-empty messaging instead of a selection prompt when no approvals exist", () => {
    mockVm = {
      ...mockVm,
      queueItems: [],
      selectedId: null,
      selectedApproval: null,
      queueDepth: 0,
    };

    render(<ApprovalWebView />);

    expect(screen.getAllByText("后端当前没有返回待审批项。").length).toBeGreaterThan(0);
    expect(screen.queryByText("尚未选择审批项")).toBeNull();
  });
});
