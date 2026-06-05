// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSelectTask = vi.fn();
const mockClaimTask = vi.fn();
const mockPauseTask = vi.fn();
const mockCancelTask = vi.fn();
const mockRetryTask = vi.fn();
const mockResumeTask = vi.fn();
const mockEscalateTask = vi.fn();
const mockCreateTaskFromPrompt = vi.fn(async () => undefined);
let workflowControlsAvailable = true;
let workflowControlReason: string | null = null;

vi.mock("@aa/ui-core", async () => {
  const actual = await vi.importActual<typeof import("@aa/ui-core")>("@aa/ui-core");
  return {
    ...actual,
    FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
      <div>{rows.map((row) => <div key={row.key}>{`${row.key}: ${row.value}`}</div>)}</div>
    ),
    ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
      <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{`${item.title} ${item.description}`}</div>)}</div>
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

vi.mock("../../../../../../packages/features/task-cockpit/src/hooks", () => ({
  useTaskCockpitVm: () => ({
    loading: false,
    loadError: null,
    operationError: null,
    listItems: [{ id: "task-1", title: "Spring campaign", subtitle: "blocked · marketing" }],
    selectedTask: {
      id: "task-1",
      title: "Spring campaign",
      status: "blocked",
      owner: "growth-ops",
      currentStep: "review",
      domainId: "marketing",
      evidenceCount: 2,
      timelineDepth: 5,
      executionMode: "mock_dev",
      modelCallStatus: "not_called",
      modelProvider: "minimax",
      modelName: "minimax-m2.7",
      outputSummary: null,
      outputUri: null,
      resourceUsage: {
        cpuPercent: 62,
        memoryMb: 768,
        runtimeMinutes: 18,
      },
    },
    workflowControlsAvailable,
    workflowControlReason,
    selectTask: mockSelectTask,
    claimTask: mockClaimTask,
    pauseTask: mockPauseTask,
    cancelTask: mockCancelTask,
    retryTask: mockRetryTask,
    resumeTask: mockResumeTask,
    escalateTask: mockEscalateTask,
    createTaskFromPrompt: mockCreateTaskFromPrompt,
    pendingOperations: 0,
    stepViewer: {
      steps: [{ id: "s1", title: "Collect inputs", status: "completed", executor: "agent-1" }],
      selectedStep: null,
      stepOutputs: [],
      selectStep: vi.fn(),
    },
    evidenceViewer: {
      evidenceChain: [{ id: "e1", type: "artifact", description: "Approval packet" }],
      loading: false,
    },
    timelineViewer: {
      timelineEvents: [{ id: "t1", title: "Escalated", description: "Escalated to domain-admin" }],
      expandedEventId: null,
      expandEvent: vi.fn(),
    },
    timelineItems: [],
    refreshTasks: vi.fn(async () => undefined),
  }),
}));

import { TaskCockpitWebView } from "../../../../../../packages/features/task-cockpit/src/web";

afterEach(() => {
  vi.clearAllMocks();
  workflowControlsAvailable = true;
  workflowControlReason = null;
  cleanup();
});

describe("TaskCockpitWebView", () => {
  it("renders L3-L5 drill-down tabs and their content", () => {
    render(<TaskCockpitWebView />);

    expect(screen.queryByText(/L3 详情/)).not.toBeNull();
    expect(screen.queryByText(/CPU: 62%/)).not.toBeNull();
    expect(screen.queryByText(/内存: 768 MB/)).not.toBeNull();
    expect(screen.queryByText(/执行模式: mock_dev/)).not.toBeNull();
    expect(screen.queryByText(/模型调用: not_called/)).not.toBeNull();
    expect(screen.queryByText(/模型: minimax \/ minimax-m2.7/)).not.toBeNull();
    expect(screen.queryByText(/输出: 尚未产生真实模型输出/)).not.toBeNull();
    expect(screen.queryByText(/Collect inputs completed · agent-1/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "L4 证据" }));
    expect(screen.queryByText(/artifact Approval packet/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "L5 时间线" }));
    expect(screen.queryByText(/Escalated Escalated to domain-admin/)).not.toBeNull();
  });

  it("wires takeover, pause, cancel, retry, resume, and escalate controls", () => {
    render(<TaskCockpitWebView />);

    fireEvent.click(screen.getAllByRole("button", { name: "接管" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    fireEvent.click(screen.getByRole("button", { name: "恢复" }));
    fireEvent.click(screen.getByRole("button", { name: "受监督恢复" }));
    fireEvent.click(screen.getByRole("button", { name: "升级" }));

    expect(mockClaimTask).toHaveBeenCalled();
    expect(mockPauseTask).toHaveBeenCalled();
    expect(mockCancelTask).toHaveBeenCalled();
    expect(mockRetryTask).toHaveBeenCalled();
    expect(mockResumeTask).toHaveBeenCalledWith("normal");
    expect(mockResumeTask).toHaveBeenCalledWith("supervised");
    expect(mockEscalateTask).toHaveBeenCalled();
  });

  it("renders and submits the task creation entry", () => {
    render(<TaskCockpitWebView />);

    fireEvent.change(screen.getByLabelText("任务描述"), {
      target: { value: "分析本周告警并生成修复计划" },
    });
    fireEvent.change(screen.getByLabelText("任务领域"), {
      target: { value: "platform-ops" },
    });
    fireEvent.change(screen.getByLabelText("负责人"), {
      target: { value: "platform-sre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    expect(mockCreateTaskFromPrompt).toHaveBeenCalledWith({
      title: "分析本周告警并生成修复计划",
      domainId: "platform-ops",
      owner: "platform-sre",
    });
  });

  it("sanitizes operator and escalation target inputs before invoking actions", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(<TaskCockpitWebView />);

    fireEvent.change(screen.getByLabelText("接管操作员 ID"), {
      target: { value: "ops<script>" },
    });
    fireEvent.change(screen.getByLabelText("升级目标 ID"), {
      target: { value: "domain-admin!!" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "接管" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "升级" }));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockClaimTask).toHaveBeenCalledWith("opsscript");
    expect(mockEscalateTask).toHaveBeenCalledWith("domain-admin");
    alertSpy.mockRestore();
  });

  it("disables workflow control buttons when the task lacks a live workflow control record", () => {
    workflowControlsAvailable = false;
    workflowControlReason = "This task does not have a live workflow control record, so pause/retry/resume controls are unavailable.";

    render(<TaskCockpitWebView />);

    expect(screen.getByRole("note")).toHaveTextContent(/live workflow control record/);
    expect(screen.getAllByRole("button", { name: "接管" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "暂停" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "重试" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "恢复" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "受监督恢复" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "升级" })).toBeDisabled();
  });
});
