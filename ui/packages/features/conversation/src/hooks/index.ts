import { ConversationClient, type ConversationStatus } from "@aa/shared-nl-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WSClient, WSEventEnvelope } from "@aa/shared-api-client";

export interface Message {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly timestamp: string;
}

export interface ConversationVm {
  readonly messages: readonly Message[];
  readonly status: ConversationStatus;
  readonly draft: string;
  readonly planReady: boolean;
  readonly executionReady: boolean;
  readonly streaming: boolean;
  setDraft(value: string): void;
  sendPrompt(): Promise<void>;
  buildPlan(): Promise<void>;
  confirmPlan(): void;
  executePlan(): Promise<void>;
  requestClarification(): void;
  disconnect(): void;
}

export function useConversationVm(wsClient?: WSClient | null): ConversationVm {
  const client = useMemo(() => new ConversationClient(), []);
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [status, setStatus] = useState<ConversationStatus>(client.getStatus());
  const [draft, setDraft] = useState("帮我发起营销活动");
  const [planReady, setPlanReady] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const initialMessages = client.listMessages();
    setMessages(initialMessages.map((msg, i) => ({
      id: `msg-${i}`,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: new Date().toISOString(),
    })));

    if (wsClient != null) {
      unsubscribeRef.current = wsClient.subscribe("conversation", (event: WSEventEnvelope) => {
        if (event.type === "message" || event.type === "streaming") {
          const payload = event.payload as { role?: string; content?: string; status?: ConversationStatus };
          if (payload.content) {
            setMessages((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                role: (payload.role as "user" | "assistant" | "system") ?? "assistant",
                content: payload.content,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
          if (payload.status) {
            setStatus(payload.status);
            if (payload.status === "streaming") {
              setStreaming(true);
            } else if (payload.status === "idle" || payload.status === "error") {
              setStreaming(false);
            }
          }
        }
      });

      wsClient.onStatusChange((wsStatus) => {
        if (wsStatus === "connected") {
          setStatus("connected");
        } else if (wsStatus === "disconnected") {
          setStatus("disconnected");
        }
      });
    }

    return () => {
      unsubscribeRef.current?.();
    };
  }, [client, wsClient]);

  const syncState = useCallback((nextPlanReady: boolean, nextExecutionReady: boolean) => {
    const currentMessages = client.listMessages();
    setMessages(currentMessages.map((msg, i) => ({
      id: `msg-${i}`,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: new Date().toISOString(),
    })));
    setStatus(client.getStatus());
    setPlanReady(nextPlanReady);
    setExecutionReady(nextExecutionReady);
  }, [client]);

  const sendPrompt = useCallback(async () => {
    if (wsClient != null) {
      wsClient.publish({
        channel: "conversation",
        type: "user_message",
        payload: { content: draft, timestamp: new Date().toISOString() },
      });
    }
    client.send(draft);
    syncState(false, false);
  }, [client, draft, syncState, wsClient]);

  const buildPlan = useCallback(async () => {
    if (wsClient != null) {
      wsClient.publish({
        channel: "conversation",
        type: "build_plan",
        payload: { draft },
      });
      setStreaming(true);
    }
    client.buildPlan("已生成执行计划：创建活动、拉取素材、等待审批、投放并回收指标。");
    client.confirm("计划已生成，是否确认进入执行？");
    syncState(true, false);
  }, [client, draft, syncState, wsClient]);

  const confirmPlan = useCallback(() => {
    client.confirm("用户已确认计划，系统进入执行前检查。");
    syncState(planReady, true);
  }, [client, planReady, syncState]);

  const executePlan = useCallback(async () => {
    if (wsClient != null) {
      wsClient.publish({
        channel: "conversation",
        type: "execute_plan",
        payload: {},
      });
    }
    client.execute("任务已进入执行态，开始创建 campaign 并分配预算。");
    client.pushAssistant("执行完成：活动草案已创建，指标回传已接通。");
    syncState(true, true);
  }, [client, syncState, wsClient]);

  const requestClarification = useCallback(() => {
    if (wsClient != null) {
      wsClient.publish({
        channel: "conversation",
        type: "clarification",
        payload: { content: "预算上限和投放时区还不清楚，请确认。" },
      });
    }
    client.requestClarification("预算上限和投放时区还不清楚，请确认。");
    syncState(planReady, executionReady);
  }, [client, executionReady, planReady, syncState, wsClient]);

  const disconnect = useCallback(() => {
    unsubscribeRef.current?.();
    wsClient?.disconnect();
  }, [wsClient]);

  return {
    messages,
    status,
    draft,
    planReady,
    executionReady,
    streaming,
    setDraft,
    sendPrompt,
    buildPlan,
    confirmPlan,
    executePlan,
    requestClarification,
    disconnect,
  };
}
