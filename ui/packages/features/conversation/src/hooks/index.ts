import { ConversationClient, type ConversationMessage, type ConversationStatus } from "@aa/shared-nl-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WSClient, WSEventEnvelope } from "@aa/shared-api-client";

export interface Message {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly timestamp: string;
}

export interface AttachmentItem {
  readonly id: string;
  readonly name: string;
  readonly sizeLabel: string;
}

export interface ConversationVm {
  readonly messages: readonly Message[];
  readonly attachments: readonly AttachmentItem[];
  readonly status: ConversationStatus | "connected" | "disconnected" | "running" | "waiting_clarification" | "error";
  readonly draft: string;
  readonly planReady: boolean;
  readonly executionReady: boolean;
  readonly isStreaming: boolean;
  setDraft(value: string): void;
  attachFiles(files: FileList | readonly File[]): void;
  sendPrompt(): Promise<void>;
  buildPlan(): Promise<void>;
  confirmPlan(): void;
  executePlan(): Promise<void>;
  requestClarification(): void;
  disconnect(): void;
}

interface PersistedConversationState {
  readonly messages: readonly Message[];
  readonly attachments: readonly AttachmentItem[];
  readonly status: ConversationVm["status"];
  readonly planReady: boolean;
  readonly executionReady: boolean;
  readonly isStreaming: boolean;
}

const STORAGE_KEY = "aa.conversation.vm";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${bytes} B`;
}

function mapConversationMessages(messages: readonly ConversationMessage[]): readonly Message[] {
  return messages.map((message, index) => ({
    id: message.id ?? `msg-${index + 1}`,
    role: message.role,
    content: message.content,
    timestamp: new Date().toISOString(),
  }));
}

function persistState(state: PersistedConversationState): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadPersistedState(): PersistedConversationState | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw == null) {
    return null;
  }
  try {
    return JSON.parse(raw) as PersistedConversationState;
  } catch {
    return null;
  }
}

export function useConversationVm(wsClient?: WSClient | null): ConversationVm {
  const persisted = loadPersistedState();
  const [messages, setMessages] = useState<readonly Message[]>(persisted?.messages ?? []);
  const [attachments, setAttachments] = useState<readonly AttachmentItem[]>(persisted?.attachments ?? []);
  const [status, setStatus] = useState<ConversationVm["status"]>(persisted?.status ?? "idle");
  const [draft, setDraft] = useState("帮我发起营销活动");
  const [planReady, setPlanReady] = useState(persisted?.planReady ?? false);
  const [executionReady, setExecutionReady] = useState(persisted?.executionReady ?? false);
  const [isStreaming, setIsStreaming] = useState(persisted?.isStreaming ?? false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const client = useMemo(() => new ConversationClient({
    initialMessages: persisted?.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    })),
    onStateChange: (snapshot: {
      messages?: readonly ConversationMessage[];
      status?: ConversationVm["status"];
      planReady?: boolean;
      executionReady?: boolean;
      isStreaming?: boolean;
    }) => {
      if (snapshot.messages != null) {
        setMessages(mapConversationMessages(snapshot.messages));
      }
      if (snapshot.status != null) {
        setStatus(snapshot.status);
      }
      if (snapshot.planReady != null) {
        setPlanReady(snapshot.planReady);
      }
      if (snapshot.executionReady != null) {
        setExecutionReady(snapshot.executionReady);
      }
      if (snapshot.isStreaming != null) {
        setIsStreaming(snapshot.isStreaming);
      }
    },
  } as never), []);

  const syncFromClient = useCallback((overrides?: Partial<PersistedConversationState>) => {
    const snapshot = typeof (client as { getSnapshot?: () => {
      messages?: readonly ConversationMessage[];
      status?: ConversationVm["status"];
      planReady?: boolean;
      executionReady?: boolean;
      isStreaming?: boolean;
    }; }).getSnapshot === "function"
      ? (client as { getSnapshot: () => {
        messages?: readonly ConversationMessage[];
        status?: ConversationVm["status"];
        planReady?: boolean;
        executionReady?: boolean;
        isStreaming?: boolean;
      }; }).getSnapshot()
      : {
        messages: typeof (client as { listMessages?: () => readonly ConversationMessage[]; }).listMessages === "function"
          ? (client as { listMessages: () => readonly ConversationMessage[]; }).listMessages()
          : [],
        status: typeof (client as { getStatus?: () => ConversationVm["status"]; }).getStatus === "function"
          ? (client as { getStatus: () => ConversationVm["status"]; }).getStatus()
          : status,
      };

    const nextMessages = snapshot.messages != null ? mapConversationMessages(snapshot.messages) : messages;
    const nextStatus = snapshot.status ?? status;
    const nextPlanReady = snapshot.planReady ?? planReady;
    const nextExecutionReady = snapshot.executionReady ?? executionReady;
    const nextIsStreaming = snapshot.isStreaming ?? isStreaming;

    setMessages(nextMessages);
    setStatus(nextStatus);
    setPlanReady(nextPlanReady);
    setExecutionReady(nextExecutionReady);
    setIsStreaming(nextIsStreaming);

    persistState({
      messages: nextMessages,
      attachments,
      status: overrides?.status ?? nextStatus,
      planReady: overrides?.planReady ?? nextPlanReady,
      executionReady: overrides?.executionReady ?? nextExecutionReady,
      isStreaming: overrides?.isStreaming ?? nextIsStreaming,
    });
  }, [attachments, client, executionReady, isStreaming, messages, planReady, status]);

  useEffect(() => {
    persistState({ messages, attachments, status, planReady, executionReady, isStreaming });
  }, [attachments, executionReady, isStreaming, messages, planReady, status]);

  useEffect(() => {
    if (wsClient == null) {
      return;
    }
    unsubscribeRef.current = wsClient.subscribe("conversation", (event: WSEventEnvelope) => {
      const payload = event.payload as { role?: "assistant" | "system" | "user"; content?: string; delta?: string; status?: ConversationVm["status"] };
      if (payload.delta != null) {
        setMessages((current) => {
          const lastMessage = current[current.length - 1];
          if (lastMessage != null && lastMessage.role === "assistant") {
            return [
              ...current.slice(0, -1),
              { ...lastMessage, content: `${lastMessage.content}${payload.delta}` },
            ];
          }
          return [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: payload.delta,
              timestamp: new Date().toISOString(),
            },
          ];
        });
        setIsStreaming(true);
      } else if (payload.content != null) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: payload.role ?? "assistant",
            content: payload.content,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      if (payload.status != null) {
        setStatus(payload.status);
        if (payload.status !== "running" && payload.status !== "connected") {
          setIsStreaming(payload.status === "parsing" || payload.status === "building");
        }
      }
    });
    wsClient.onStatusChange((wsStatus) => {
      setStatus(wsStatus === "connected" ? "connected" : "disconnected");
      if (wsStatus !== "connected") {
        setIsStreaming(false);
      }
    });
    return () => {
      unsubscribeRef.current?.();
    };
  }, [wsClient]);

  const attachFiles = useCallback((files: FileList | readonly File[]) => {
    const normalizedFiles = Array.from(files);
    setAttachments((current) => [
      ...current,
      ...normalizedFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        sizeLabel: formatSize(file.size),
      })),
    ]);
  }, []);

  const sendPrompt = useCallback(async () => {
    if (draft.trim().length === 0) {
      return;
    }
    wsClient?.publish({
      channel: "conversation",
      type: "user_message",
      payload: {
        content: draft,
        attachments: attachments.map((attachment) => attachment.name),
      },
    });
    client.send(draft);
    syncFromClient({ planReady: false, executionReady: false, isStreaming: false });
  }, [attachments, client, draft, syncFromClient, wsClient]);

  const buildPlan = useCallback(async () => {
    wsClient?.publish({
      channel: "conversation",
      type: "build_plan",
      payload: { draft },
    });
    client.buildPlan("已生成执行计划：创建活动、拉取素材、等待审批、投放并回收指标。");
    syncFromClient({ planReady: true, executionReady: false, isStreaming: true, status: "building" });
  }, [client, draft, syncFromClient, wsClient]);

  const confirmPlan = useCallback(() => {
    client.confirm("用户已确认计划，系统进入执行前检查。");
    syncFromClient({ planReady: true, executionReady: true, isStreaming: false, status: "confirming" });
  }, [client, syncFromClient]);

  const requestClarification = useCallback(() => {
    const content = "预算上限和投放时区还不清楚，请确认。";
    wsClient?.publish({
      channel: "conversation",
      type: "clarification",
      payload: { content },
    });
    client.requestClarification(content);
    syncFromClient({ status: "waiting_clarification", isStreaming: false });
  }, [client, syncFromClient, wsClient]);

  const executePlan = useCallback(async () => {
    if (!executionReady) {
      requestClarification();
      return;
    }
    wsClient?.publish({
      channel: "conversation",
      type: "execute_plan",
      payload: {
        attachments: attachments.map((attachment) => attachment.name),
      },
    });
    client.execute("任务已进入执行态，开始创建 campaign 并分配预算。");
    if (typeof (client as { pushAssistant?: (content: string) => unknown; }).pushAssistant === "function") {
      (client as { pushAssistant: (content: string) => unknown; }).pushAssistant("执行完成：活动草案已创建，指标回传已接通。");
    }
    syncFromClient({ planReady: true, executionReady: true, isStreaming: false, status: "running" });
  }, [attachments, client, executionReady, requestClarification, syncFromClient, wsClient]);

  const disconnect = useCallback(() => {
    unsubscribeRef.current?.();
    if (typeof (client as { dispose?: () => void; }).dispose === "function") {
      (client as { dispose: () => void; }).dispose();
    }
    wsClient?.disconnect();
  }, [client, wsClient]);

  return {
    messages,
    attachments,
    status,
    draft,
    planReady,
    executionReady,
    isStreaming,
    setDraft,
    attachFiles,
    sendPrompt,
    buildPlan,
    confirmPlan,
    executePlan,
    requestClarification,
    disconnect,
  };
}
