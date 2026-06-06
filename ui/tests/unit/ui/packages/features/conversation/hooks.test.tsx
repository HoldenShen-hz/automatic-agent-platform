// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSharedTranslationService, resetSharedTranslationService } from "@aa/shared-i18n";

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

const conversationState = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  requestClarificationSpy: vi.fn(),
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

    getSnapshot() {
      return this.snapshot;
    }

    private emit() {
      this.onStateChange?.(this.snapshot);
    }

    send(message: string) {
      conversationState.sendSpy(message);
      this.snapshot = {
        ...this.snapshot,
        messages: [...this.snapshot.messages, { role: "user", content: message }],
      };
      this.emit();
    }

    buildPlan(message: string) {
      this.snapshot = { ...this.snapshot, messages: [...this.snapshot.messages, { role: "assistant", content: message }], planReady: true };
      this.emit();
    }

    confirm(message: string) {
      this.snapshot = { ...this.snapshot, messages: [...this.snapshot.messages, { role: "assistant", content: message }], executionReady: true };
      this.emit();
    }

    execute(message: string) {
      this.snapshot = { ...this.snapshot, messages: [...this.snapshot.messages, { role: "assistant", content: message }], status: "running" };
      this.emit();
    }

    requestClarification(message: string) {
      conversationState.requestClarificationSpy(message);
      this.snapshot = { ...this.snapshot, messages: [...this.snapshot.messages, { role: "assistant", content: message }], status: "waiting_clarification" };
      this.emit();
    }

    dispose() {}
  },
}));

import {
  conversationVmQueryClient,
  conversationVmQueryKey,
  useConversationVm,
} from "../../../../../../packages/features/conversation/src/hooks/index.ts";

describe("useConversationVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    conversationVmQueryClient.clear();
    resetSharedTranslationService();
    getSharedTranslationService().setLocale("en-US");
  });

  it("hydrates recent completed conversation state on the first render", () => {
    window.sessionStorage.setItem("aa.conversation.vm", JSON.stringify({
      messages: [
        {
          id: "msg-persisted",
          role: "assistant",
          content: "Recovered from storage",
          timestamp: "2026-06-05T00:00:00.000Z",
        },
      ],
      attachments: [
        {
          id: "att-1",
          name: "report.md",
          sizeLabel: "2 KB",
        },
      ],
      status: "connected",
      planReady: true,
      executionReady: true,
      isStreaming: false,
      activeTaskId: null,
      updatedAt: new Date().toISOString(),
    }));

    const { result } = renderHook(() => useConversationVm());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      content: "Recovered from storage",
      role: "assistant",
    });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.status).toBe("connected");
    expect(result.current.planReady).toBe(true);
    expect(result.current.executionReady).toBe(true);
  });

  it("restores only active in-flight conversation state", () => {
    window.sessionStorage.setItem("aa.conversation.vm", JSON.stringify({
      messages: [
        {
          id: "msg-persisted",
          role: "assistant",
          content: "Recovered from storage",
          timestamp: "2026-06-05T00:00:00.000Z",
        },
      ],
      attachments: [],
      status: "running",
      planReady: true,
      executionReady: true,
      isStreaming: true,
      activeTaskId: "task-running-001",
      updatedAt: new Date().toISOString(),
    }));

    const { result } = renderHook(() => useConversationVm());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      content: "Recovered from storage",
      role: "assistant",
    });
    expect(result.current.status).toBe("running");
    expect(result.current.planReady).toBe(true);
    expect(result.current.executionReady).toBe(true);
  });

  it("ignores empty connected conversation snapshots with no recoverable history", () => {
    window.sessionStorage.setItem("aa.conversation.vm", JSON.stringify({
      messages: [],
      attachments: [],
      status: "connected",
      planReady: false,
      executionReady: false,
      isStreaming: false,
      activeTaskId: null,
      updatedAt: new Date().toISOString(),
    }));

    const { result } = renderHook(() => useConversationVm());

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.planReady).toBe(false);
    expect(result.current.executionReady).toBe(false);
  });

  it("sends prompts directly and restores persisted history across remounts", async () => {
    const { result, unmount } = renderHook(() => useConversationVm());

    act(() => {
      result.current.setDraft("Ship the release");
    });
    act(() => {
      void result.current.sendPrompt();
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBe(1);
    });

    expect(conversationState.sendSpy).toHaveBeenCalledWith("Ship the release");
    expect(result.current.status).toBe("disconnected");
    expect(result.current.planReady).toBe(false);
    expect(result.current.executionReady).toBe(false);

    act(() => {
      result.current.executePlan();
    });

    expect(conversationState.requestClarificationSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    unmount();

    const remounted = renderHook(() => useConversationVm());
    await waitFor(() => {
      expect(remounted.result.current.messages.length).toBe(2);
    });
    expect(conversationVmQueryClient.getQueryData(conversationVmQueryKey)).toMatchObject({
      status: "waiting_clarification",
      isStreaming: false,
    });
  });

  it("ignores locally echoed conversation control events", async () => {
    const handlers = new Map<string, (event: { channel: string; type: string; payload: unknown }) => void>();
    const wsClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn((channel: string, handler: (event: { channel: string; type: string; payload: unknown }) => void) => {
        handlers.set(channel, handler);
        return () => {
          handlers.delete(channel);
        };
      }),
      onStatusChange: vi.fn((handler: (status: "connected" | "disconnected") => void) => {
        handler("connected");
        return () => undefined;
      }),
      publish: vi.fn((event: { channel: string; type: string; payload: unknown }) => {
        handlers.get(event.channel)?.(event);
      }),
      useSseFallback: vi.fn(),
    };

    const { result } = renderHook(() => useConversationVm(wsClient));

    act(() => {
      result.current.setDraft("Echo-safe prompt");
    });
    await act(async () => {
      await result.current.sendPrompt();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Echo-safe prompt",
    });
    expect(result.current.status).toBe("connected");
  });
});
