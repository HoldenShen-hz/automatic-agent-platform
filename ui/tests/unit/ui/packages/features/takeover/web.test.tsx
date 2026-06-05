// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockTakeoverCurrentTask = vi.fn(async () => undefined);
const mockAnnotateCurrentSnapshot = vi.fn();
const mockResumeAutomaticExecution = vi.fn(async () => undefined);
const mockRefresh = vi.fn(async () => undefined);

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FeatureWorkbenchPanel: (
    { items, actions }: {
      items: Array<{ title: string; description: string }>;
      actions: Array<{ id: string; label: string; onTrigger?: () => void | Promise<void> }>;
    },
  ) => (
    <div>
      {items.map((item) => <div key={item.title}>{item.title}</div>)}
      {actions.map((action) => (
        <button key={action.id} type="button" onClick={() => void action.onTrigger?.()}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../../../../../packages/features/takeover/src/hooks", () => ({
  useTakeoverVm: () => ({
    items: [{ title: "Execution Snapshot", description: "Captured context" }],
    loading: false,
    mutating: false,
    errorMessage: null,
    currentSnapshot: {
      taskId: "task-1",
      owner: "web-operator",
      status: "running",
      capturedAt: "2026-06-05T00:00:00.000Z",
      steps: [{ id: "step-1", title: "Collect inputs", status: "completed", executor: "agent-1" }],
    },
    ownershipHistory: [
      {
        taskId: "task-1",
        owner: "web-operator",
        action: "claim",
        recordedAt: "2026-06-05T00:00:00.000Z",
      },
    ],
    canTakeover: true,
    canAnnotate: true,
    canResume: true,
    takeoverCurrentTask: mockTakeoverCurrentTask,
    annotateCurrentSnapshot: mockAnnotateCurrentSnapshot,
    resumeAutomaticExecution: mockResumeAutomaticExecution,
    refresh: mockRefresh,
  }),
}));

import { TakeoverWebView } from "../../../../../../packages/features/takeover/src/web";

afterEach(() => {
  cleanup();
});

describe("TakeoverWebView", () => {
  it("wires takeover actions to executable handlers", () => {
    render(<TakeoverWebView />);

    expect(screen.getByText("Current snapshot")).toBeTruthy();
    expect(screen.getByText(/会写入后端 takeover session 与 operator action 审计链/)).toBeTruthy();
    expect(screen.getByText("task-1")).toBeTruthy();
    expect(screen.getByText("Collect inputs · completed · agent-1")).toBeTruthy();
    expect(screen.getByText("Ownership history")).toBeTruthy();
    expect(screen.getByText("2026-06-05T00:00:00.000Z · task-1 · web-operator · claim")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "接管当前任务" }));
    fireEvent.click(screen.getByRole("button", { name: "添加人工批注" }));
    fireEvent.click(screen.getByRole("button", { name: "恢复任务运行" }));
    fireEvent.click(screen.getByRole("button", { name: "刷新接管快照" }));

    expect(mockTakeoverCurrentTask).toHaveBeenCalledWith("web-operator");
    expect(mockAnnotateCurrentSnapshot).toHaveBeenCalledWith("manual-note", "web-operator");
    expect(mockResumeAutomaticExecution).toHaveBeenCalledWith("web-operator");
    expect(mockRefresh).toHaveBeenCalled();
  });
});
