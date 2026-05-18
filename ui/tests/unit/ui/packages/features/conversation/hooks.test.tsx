import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const conversationState = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  requestClarificationSpy: vi.fn(),
}));

vi.mock("@aa/shared-nl-client", () => ({
  ConversationClient: class MockConversationClient {
    private snapshot;
    private readonly onStateChange: ((snapshot: any) => void) | undefined;

    constructor(options: { initialMessages?: any[]; onStateChange?: (snapshot: any) => void }) {
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
} from "../../../../../../packages/features/conversation/src/hooks";

describe("useConversationVm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    conversationVmQueryClient.clear();
  });

  it("sends prompts directly and restores persisted history across remounts", async () => {
    const { result, unmount } = renderHook(() => useConversationVm());

    act(() => {
      result.current.setDraft("Ship the release");
    });
    act(() => {
      result.current.sendPrompt();
      result.current.executePlan();
    });

    expect(conversationState.sendSpy).toHaveBeenCalledWith("Ship the release");
    expect(conversationState.requestClarificationSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    unmount();

    const remounted = renderHook(() => useConversationVm());
    expect(remounted.result.current.messages.length).toBe(2);
    expect(conversationVmQueryClient.getQueryData(conversationVmQueryKey)).toMatchObject({
      status: "waiting_clarification",
      isStreaming: false,
    });
  });
});
