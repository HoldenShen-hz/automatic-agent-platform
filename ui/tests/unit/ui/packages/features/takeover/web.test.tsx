// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockTakeoverCurrentTask = vi.fn(async () => undefined);
const mockAnnotateCurrentSnapshot = vi.fn();
const mockResumeAutomaticExecution = vi.fn(async () => undefined);

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
    takeoverCurrentTask: mockTakeoverCurrentTask,
    annotateCurrentSnapshot: mockAnnotateCurrentSnapshot,
    resumeAutomaticExecution: mockResumeAutomaticExecution,
  }),
}));

import { TakeoverWebView } from "../../../../../../packages/features/takeover/src/web";

afterEach(() => {
  cleanup();
});

describe("TakeoverWebView", () => {
  it("wires takeover actions to executable handlers", () => {
    render(<TakeoverWebView />);

    fireEvent.click(screen.getByRole("button", { name: "接管当前任务" }));
    fireEvent.click(screen.getByRole("button", { name: "添加人工批注" }));
    fireEvent.click(screen.getByRole("button", { name: "恢复自动执行" }));

    expect(mockTakeoverCurrentTask).toHaveBeenCalledWith("web-operator");
    expect(mockAnnotateCurrentSnapshot).toHaveBeenCalledWith("manual-note", "web-operator");
    expect(mockResumeAutomaticExecution).toHaveBeenCalledWith("web-operator");
  });
});
