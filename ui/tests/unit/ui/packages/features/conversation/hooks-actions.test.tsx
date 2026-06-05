// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockConversationMessage = {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
};

type MockConversationSnapshot = {
  readonly messages: readonly MockConversationMessage[];
  readonly status: string;
  readonly planReady: boolean;
  readonly executionReady: boolean;
  readonly isStreaming: boolean;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  client: { post: vi.fn(), get: vi.fn() },
  createTask: vi.fn(),
  fetchTasks: vi.fn(),
  publish: vi.fn(),
}));

vi.mock("@aa/shared-state", () => ({
  useRestClient: () => mocks.client,
}));

vi.mock("@aa/shared-api-client", () => ({
  createTask: mocks.createTask,
  fetchTasks: mocks.fetchTasks,
}));

vi.mock("@aa/shared-nl-client", () => ({
  ConversationClient: class MockConversationClient {
    private snapshot: MockConversationSnapshot;
    private readonly onStateChange: ((snapshot: MockConversationSnapshot) => void) | undefined;

    constructor(options: {
      initialMessages?: readonly MockConversationMessage[];
      onStateChange?: (snapshot: MockConversationSnapshot) => void;
    }) {
      this.onStateChange = options.onStateChange;
      this.snapshot = {
        messages: options.initialMessages ?? [],
        status: "idle",
        planReady: false,
        executionReady: false,
        isStreaming: false,
      };
    }

    public getSnapshot() {
      return this.snapshot;
    }

    private emit() {
      this.onStateChange?.(this.snapshot);
    }

    public buildPlan(message: string) {
      this.snapshot = {
        ...this.snapshot,
        messages: [...this.snapshot.messages, { role: "assistant", content: message }],
        planReady: true,
      };
      this.emit();
    }

    public confirm(message: string) {
      this.snapshot = {
        ...this.snapshot,
        messages: [...this.snapshot.messages, { role: "assistant", content: message }],
        executionReady: true,
      };
      this.emit();
    }

    public requestClarification(message: string) {
      this.snapshot = {
        ...this.snapshot,
        messages: [...this.snapshot.messages, { role: "assistant", content: message }],
        status: "waiting_clarification",
      };
      this.emit();
    }

    public send(message: string) {
      this.snapshot = {
        ...this.snapshot,
        messages: [...this.snapshot.messages, { role: "user", content: message }],
      };
      this.emit();
    }

    public dispose() {}
  },
}));

import { useConversationVm } from "../../../../../../packages/features/conversation/src/hooks";

describe("useConversationVm action guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.client.get.mockResolvedValue({
      snapshot: {
        task: {
          status: "done",
          outputJson: JSON.stringify({
            outputSummary: "real task finished",
          }),
        },
      },
    });
  });

  it("submits only one real task while execution is already in flight", async () => {
    const deferredCreate = createDeferred<{ snapshot: { task: { id: string } } }>();
    mocks.createTask.mockReturnValueOnce(deferredCreate.promise);
    const wsClient = {
      publish: mocks.publish,
      subscribe: vi.fn(() => () => undefined),
      onStatusChange: vi.fn(() => () => undefined),
      disconnect: vi.fn(),
    };
    const { result } = renderHook(() => useConversationVm(wsClient));

    act(() => {
      result.current.setDraft("Research ways to improve coding with LLMs");
    });
    await act(async () => {
      await result.current.buildPlan();
    });
    act(() => {
      result.current.confirmPlan();
    });

    expect(result.current.executionReady).toBe(true);

    let firstExecution: Promise<void>;
    let secondExecution: Promise<void>;
    await act(async () => {
      firstExecution = result.current.executePlan();
      secondExecution = result.current.executePlan();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.createTask).toHaveBeenCalledTimes(1);
      expect(result.current.isExecuting).toBe(true);
      expect(result.current.executionReady).toBe(false);
    });

    deferredCreate.resolve({ snapshot: { task: { id: "task_001" } } });

    await act(async () => {
      await Promise.all([firstExecution!, secondExecution!]);
    });

    await waitFor(() => {
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.status).toBe("connected");
    });
  });

  it("treats backend done status as a completed real-task result and surfaces the report summary", async () => {
    mocks.createTask.mockResolvedValueOnce({ snapshot: { task: { id: "task_done_001" } } });
    mocks.client.get.mockResolvedValueOnce({
      snapshot: {
        task: {
          status: "done",
          outputJson: JSON.stringify({
            outputSummary: "MiniMax delivered the final markdown report",
            outputUri: "/tmp/report.md",
          }),
        },
      },
    });
    const wsClient = {
      publish: mocks.publish,
      subscribe: vi.fn(() => () => undefined),
      onStatusChange: vi.fn(() => () => undefined),
      disconnect: vi.fn(),
    };
    const { result } = renderHook(() => useConversationVm(wsClient));

    act(() => {
      result.current.setDraft("请调研大模型提升 code 方案");
    });
    await act(async () => {
      await result.current.buildPlan();
    });
    act(() => {
      result.current.confirmPlan();
    });

    await act(async () => {
      await result.current.executePlan();
    });

    await waitFor(() => {
      expect(result.current.isExecuting).toBe(false);
      expect(result.current.status).toBe("connected");
      expect(result.current.messages.at(-1)?.content).toBe("MiniMax delivered the final markdown report");
    });
    expect(mocks.client.get).toHaveBeenCalledWith("/v1/tasks/task_done_001");
  });
});
