import type { WSClient, WSEventEnvelope } from "@aa/shared-api-client";
import { ConversationClient, type ConversationStatus, type ConversationMessage } from "@aa/shared-nl-client";
import { useCallback, useEffect, useRef, useState } from "react";

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

type WsMessagePayload = { role: "user" | "assistant" | "system"; content: string };

/**
 * §4.6.1: Subscribe to nl.session.updated / nl.plan.created events for real-time updates.
 * WS streaming is the primary path; in-memory ConversationClient is only for local fallback.
 */
export function useConversationVm(options: ConversationVmOptions = {}): ConversationVm {
  const { wsClient, userId } = options;
  const clientRef = useRef(new ConversationClient());
  const [messages, setMessages] = useState<readonly ConversationMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [draft, setDraftState] = useState("帮我发起营销活动");
  const [planReady, setPlanReady] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // §4.6.1: Real-time event subscription for nl.session.updated / nl.plan.created
  useEffect(() => {
    if (wsClient == null || userId == null) {
      // Fallback: initialize from in-memory client when no WS available
      setMessages(clientRef.current.listMessages());
      setStatus(clientRef.current.getStatus());
      return;
    }

    setIsStreaming(true);
    const sessionChannel = `nl.session.${userId}`;
    const planChannel = "nl.plan.created";

    const unsubSession = wsClient.subscribe(sessionChannel, (event: WSEventEnvelope) => {
      if (event.type === "nl.session.updated") {
        const payload = event.payload as {
          status?: ConversationStatus;
          messages?: WsMessagePayload[];
        };
        if (payload.status) setStatus(payload.status);
        if (payload.messages) {
          // §4.6.1: Reconcile WS messages - WS is authoritative for real-time updates
          const wsMessages: ConversationMessage[] = payload.messages.map((m, i) => ({
            id: `ws-${i}`,
            role: m.role,
            content: m.content,
          }));
          setMessages(wsMessages);
        }
      }
    });

    const unsubPlan = wsClient.subscribe(planChannel, (event: WSEventEnvelope) => {
      if (event.type === "nl.plan.created") {
        const payload = event.payload as { planBundle?: unknown; planReady?: boolean };
        // §4.6.1: Live PlanBundle received via WS - update UI to reflect plan ready
        if (payload.planBundle) {
          setPlanReady(payload.planReady ?? true);
        }
      }
    });

    return () => {
      setIsStreaming(false);
      unsubSession();
      unsubPlan();
    };
  }, [wsClient, userId]);

  // §4.6.1: Sync state from in-memory client only when WS is not active
  const syncInMemoryState = useCallback((
    nextPlanReady: boolean,
    nextExecutionReady: boolean,
  ) => {
    if (wsClient == null || userId == null) {
      setMessages([...clientRef.current.listMessages()]);
      setStatus(clientRef.current.getStatus());
    }
    setPlanReady(nextPlanReady);
    setExecutionReady(nextExecutionReady);
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
      // §4.6.1: When WS is active, send via WS; otherwise fallback to in-memory
      if (wsClient != null && userId != null) {
        wsClient.publish({
          channel: `nl.session.${userId}`,
          type: "nl.prompt.sent",
          payload: { content: draft, userId },
        });
        setStatus("parsing");
      } else {
        clientRef.current.send(draft);
        clientRef.current.requestClarification("已解析请求，请确认预算上限、时区和投放窗口。");
        syncInMemoryState(false, false);
      }
    },
    buildPlan() {
      if (wsClient != null && userId != null) {
        wsClient.publish({
          channel: `nl.session.${userId}`,
          type: "nl.plan.requested",
          payload: { userId },
        });
        setStatus("building");
      } else {
        clientRef.current.buildPlan("已生成执行计划：创建活动、拉取素材、等待审批、投放并回收指标。");
        clientRef.current.confirm("计划已生成，是否确认进入执行？");
        syncInMemoryState(true, false);
      }
    },
    confirmPlan() {
      if (wsClient != null && userId != null) {
        wsClient.publish({
          channel: `nl.session.${userId}`,
          type: "nl.plan.confirmed",
          payload: { userId },
        });
        setStatus("confirming");
        syncInMemoryState(planReady, true);
      } else {
        clientRef.current.confirm("用户已确认计划，系统进入执行前检查。");
        syncInMemoryState(planReady, true);
      }
    },
    executePlan() {
      if (wsClient != null && userId != null) {
        wsClient.publish({
          channel: `nl.session.${userId}`,
          type: "nl.execution.started",
          payload: { userId },
        });
        setStatus("executing");
      } else {
        clientRef.current.execute("任务已进入执行态，开始创建 campaign 并分配预算。");
        clientRef.current.pushAssistant("执行完成：活动草案已创建，指标回传已接通。");
        syncInMemoryState(true, true);
      }
    },
    requestClarification() {
      if (wsClient != null && userId != null) {
        wsClient.publish({
          channel: `nl.session.${userId}`,
          type: "nl.clarification.requested",
          payload: { userId, question: "预算上限和投放时区还不清楚，请确认。" },
        });
        setStatus("clarifying");
      } else {
        clientRef.current.requestClarification("预算上限和投放时区还不清楚，请确认。");
        syncInMemoryState(planReady, executionReady);
      }
    },
  };
}
