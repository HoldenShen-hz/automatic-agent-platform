import type { WSClient } from "@aa/shared-api-client";
import {
  ConversationClient,
  type ConversationStatus,
  type ConversationMessage,
  type ConversationSnapshot,
} from "@aa/shared-nl-client";
import { useEffect, useRef, useState } from "react";

export interface ConversationVm {
  readonly messages: readonly { role: string; content: string }[];
  readonly status: ConversationStatus;
  readonly draft: string;
  readonly planReady: boolean;
  readonly executionReady: boolean;
  readonly isStreaming: boolean;
  setDraft(value: string): void;
  sendPrompt(): void;
  buildPlan(): void;
  confirmPlan(): void;
  executePlan(): void;
  requestClarification(): void;
}

export interface ConversationVmOptions {
  readonly wsClient?: WSClient;
  readonly userId?: string;
}

const STORAGE_KEY = "aa-conversation-messages";

// §2276: Persist messages to sessionStorage so remount restores history
function loadPersistedMessages(): ConversationMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistMessages(messages: readonly ConversationMessage[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage unavailable
  }
}

/**
 * §4.6.1: Subscribe to nl.session.updated / nl.plan.created events for real-time updates.
 * WS streaming is the primary path; in-memory ConversationClient is only for local fallback.
 */
export function useConversationVm(options: ConversationVmOptions = {}): ConversationVm {
  const { wsClient, userId } = options;
  const clientRef = useRef<ConversationClient | null>(null);
  // §2276: Initialize from persisted storage to survive remount
  const [messages, setMessages] = useState<readonly ConversationMessage[]>(loadPersistedMessages);
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [draft, setDraftState] = useState("帮我发起营销活动");
  const [planReady, setPlanReady] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  function applySnapshot(snapshot: ConversationSnapshot): void {
    setMessages(snapshot.messages);
    persistMessages(snapshot.messages);
    setStatus(snapshot.status);
    setPlanReady(snapshot.planReady);
    setExecutionReady(snapshot.executionReady);
    setIsStreaming(snapshot.isStreaming);
  }

  useEffect(() => {
    clientRef.current?.dispose();
    const client = new ConversationClient({
      ...(wsClient != null && userId != null ? { transport: wsClient, userId } : {}),
      initialMessages: loadPersistedMessages(),
      onStateChange: applySnapshot,
    });
    clientRef.current = client;
    applySnapshot(client.getSnapshot());

    return () => {
      client.dispose();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [wsClient, userId]);

  return {
    messages,
    status,
    draft,
    planReady,
    executionReady,
    isStreaming,
    setDraft(value: string) {
      setDraftState(value);
    },
    sendPrompt() {
      clientRef.current?.send(draft);
    },
    buildPlan() {
      clientRef.current?.buildPlan("已生成执行计划：创建活动、拉取素材、等待审批、投放并回收指标。");
    },
    confirmPlan() {
      clientRef.current?.confirm("用户已确认计划，系统进入执行前检查。");
    },
    executePlan() {
      if (wsClient != null && userId != null) {
        clientRef.current?.execute("系统开始执行计划。");
      } else {
        // P0 FIX: Execution requires a valid WS connection to the control plane.
        // Local in-memory simulation bypasses the intake pipeline (P1→P2 invariant).
        // User must establish a backend connection before executing.
        clientRef.current?.requestClarification("执行需要与后端建立连接。当前离线状态下无法执行任务，请检查网络连接后重试。");
      }
    },
    requestClarification() {
      clientRef.current?.requestClarification("预算上限和投放时区还不清楚，请确认。");
    },
  };
}
