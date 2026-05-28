import { ConversationClient, type ConversationMessage, type ConversationStatus } from "@aa/shared-nl-client";
import { translateMessage } from "@aa/shared-i18n";
import type { WSClient, WSEventEnvelope } from "@aa/shared-api-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  requestClarification(content?: string): void;
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

type ConversationClientSnapshot = {
  messages?: readonly ConversationMessage[];
  status?: ConversationVm["status"];
  planReady?: boolean;
  executionReady?: boolean;
  isStreaming?: boolean;
};

const STORAGE_KEY = "aa.conversation.vm";
export const conversationVmQueryKey = ["conversation", "vm"] as const;

class ConversationVmCache {
  private value: PersistedConversationState | null = null;

  public setQueryData(_key: typeof conversationVmQueryKey, nextValue: PersistedConversationState): void {
    this.value = nextValue;
  }

  public getQueryData<T>(_key: typeof conversationVmQueryKey): T | undefined {
    return this.value as T | undefined;
  }

  public clear(): void {
    this.value = null;
  }
}

export const conversationVmQueryClient = new ConversationVmCache();

function normalizeMessageRole(role: Message["role"] | undefined): Message["role"] {
  return role ?? "assistant";
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createMessage(
  role: Message["role"] | undefined,
  content: string | undefined,
  timestamp = new Date().toISOString(),
): Message {
  return {
    id: createMessageId(),
    role: normalizeMessageRole(role),
    content: content ?? "",
    timestamp,
  };
}

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
    role: normalizeMessageRole(message.role),
    content: message.content ?? "",
    timestamp: new Date().toISOString(),
  }));
}

function createDefaultPersistedState(): PersistedConversationState {
  return {
    messages: [],
    attachments: [],
    status: "idle",
    planReady: false,
    executionReady: false,
    isStreaming: false,
  };
}

function persistState(state: PersistedConversationState): void {
  conversationVmQueryClient.setQueryData(conversationVmQueryKey, state);
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Query cache remains authoritative when browser storage is unavailable.
  }
}

function readPersistedState(): PersistedConversationState | null {
  const cached = conversationVmQueryClient.getQueryData<PersistedConversationState>(conversationVmQueryKey);
  if (cached != null) {
    return cached;
  }
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw == null) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedConversationState>;
    return {
      ...createDefaultPersistedState(),
      ...(Array.isArray(parsed.messages) ? { messages: parsed.messages } : {}),
      ...(Array.isArray(parsed.attachments) ? { attachments: parsed.attachments } : {}),
      ...(typeof parsed.status === "string" ? { status: parsed.status as PersistedConversationState["status"] } : {}),
      ...(typeof parsed.planReady === "boolean" ? { planReady: parsed.planReady } : {}),
      ...(typeof parsed.executionReady === "boolean" ? { executionReady: parsed.executionReady } : {}),
      ...(typeof parsed.isStreaming === "boolean" ? { isStreaming: parsed.isStreaming } : {}),
    };
  } catch {
    return null;
  }
}

function createConversationClient(persisted: PersistedConversationState | null, onStateChange: (snapshot: ConversationClientSnapshot) => void): ConversationClient {
  const initialMessages = persisted?.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }));
  return new ConversationClient({
    ...(initialMessages == null ? {} : { initialMessages }),
    onStateChange,
  });
}

function resolveClientSnapshot(client: ConversationClient, fallbackStatus: ConversationVm["status"]): ConversationClientSnapshot {
  if (typeof (client as { getSnapshot?: () => ConversationClientSnapshot; }).getSnapshot === "function") {
    return (client as { getSnapshot: () => ConversationClientSnapshot; }).getSnapshot();
  }
  return {
    messages: typeof (client as { listMessages?: () => readonly ConversationMessage[]; }).listMessages === "function"
      ? (client as { listMessages: () => readonly ConversationMessage[]; }).listMessages()
      : [],
    status: typeof (client as { getStatus?: () => ConversationVm["status"]; }).getStatus === "function"
      ? (client as { getStatus: () => ConversationVm["status"]; }).getStatus()
      : fallbackStatus,
  };
}

export function useConversationVm(wsClient?: WSClient | null): ConversationVm {
  const defaultDraft = translateMessage("ui.conversation.defaultDraft");
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [attachments, setAttachments] = useState<readonly AttachmentItem[]>([]);
  const [status, setStatus] = useState<ConversationVm["status"]>("idle");
  const [draft, setDraft] = useState(defaultDraft);
  const [planReady, setPlanReady] = useState(false);
  const [executionReady, setExecutionReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<PersistedConversationState>(createDefaultPersistedState());
  const clientRef = useRef<ConversationClient | null>(null);
  const unsubscribeEventRef = useRef<(() => void) | null>(null);
  const unsubscribeStatusRef = useRef<(() => void) | null>(null);

  const syncPersistedSnapshot = useCallback((updater: (current: PersistedConversationState) => PersistedConversationState) => {
    const nextState = updater(stateRef.current);
    stateRef.current = nextState;
    persistState(nextState);
  }, []);

  const syncFromClient = useCallback((client: ConversationClient, overrides?: Partial<PersistedConversationState>) => {
    const snapshot = resolveClientSnapshot(client, stateRef.current.status);
    const currentState = stateRef.current;
    const nextMessages = snapshot.messages != null ? mapConversationMessages(snapshot.messages) : currentState.messages;
    const nextStatus = overrides?.status ?? snapshot.status ?? currentState.status;
    const nextPlanReady = overrides?.planReady ?? snapshot.planReady ?? currentState.planReady;
    const nextExecutionReady = overrides?.executionReady ?? snapshot.executionReady ?? currentState.executionReady;
    const nextIsStreaming = overrides?.isStreaming ?? snapshot.isStreaming ?? currentState.isStreaming;
    const nextState: PersistedConversationState = {
      messages: nextMessages,
      attachments: currentState.attachments,
      status: nextStatus,
      planReady: nextPlanReady,
      executionReady: nextExecutionReady,
      isStreaming: nextIsStreaming,
    };
    setMessages(nextMessages);
    setStatus(nextStatus);
    setPlanReady(nextPlanReady);
    setExecutionReady(nextExecutionReady);
    setIsStreaming(nextIsStreaming);
    stateRef.current = nextState;
    persistState(nextState);
  }, []);

  useEffect(() => {
    const persisted = readPersistedState();
    if (persisted != null) {
      setMessages(persisted.messages);
      setAttachments(persisted.attachments);
      setStatus(persisted.status);
      setPlanReady(persisted.planReady);
      setExecutionReady(persisted.executionReady);
      setIsStreaming(persisted.isStreaming);
      stateRef.current = persisted;
    }
    const client = createConversationClient(persisted, (snapshot) => {
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
    });
    clientRef.current = client;
    if (persisted == null) {
      syncFromClient(client);
    } else {
      persistState(stateRef.current);
    }
    return () => {
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      persistState(stateRef.current);
      try {
        (client as { dispose?: () => void; }).dispose?.();
      } catch {
        // Disposal is best-effort and should not break unmount cleanup.
      }
      clientRef.current = null;
    };
  }, [syncFromClient]);

  useEffect(() => {
    const nextState = { messages, attachments, status, planReady, executionReady, isStreaming };
    stateRef.current = nextState;
    if (persistTimeoutRef.current != null) {
      clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = setTimeout(() => {
      persistState(nextState);
      persistTimeoutRef.current = null;
    }, isStreaming ? 200 : 0);
    return () => {
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [attachments, executionReady, isStreaming, messages, planReady, status]);

  useEffect(() => {
    if (wsClient == null) {
      return;
    }
    unsubscribeEventRef.current = wsClient.subscribe("conversation", (event: WSEventEnvelope) => {
      const payload = event.payload as { role?: "assistant" | "system" | "user"; content?: string; delta?: string; status?: ConversationVm["status"] };
      if (payload.delta != null) {
        setMessages((current) => {
          const lastMessage = current[current.length - 1];
          const timestamp = new Date().toISOString();
          if (lastMessage != null && lastMessage.role === "assistant") {
            const nextMessages = [
              ...current.slice(0, -1),
              { ...lastMessage, content: `${lastMessage.content}${payload.delta}`, timestamp },
            ];
            syncPersistedSnapshot((snapshot) => ({ ...snapshot, messages: nextMessages, isStreaming: true }));
            return nextMessages;
          }
          const nextMessages = [...current, createMessage("assistant", payload.delta, timestamp)];
          syncPersistedSnapshot((snapshot) => ({ ...snapshot, messages: nextMessages, isStreaming: true }));
          return nextMessages;
        });
        setIsStreaming(true);
      } else if (payload.content != null) {
        setMessages((current) => {
          const nextMessages = [...current, createMessage(payload.role, payload.content)];
          syncPersistedSnapshot((snapshot) => ({ ...snapshot, messages: nextMessages }));
          return nextMessages;
        });
      }
      if (payload.status != null) {
        const nextStatus = payload.status;
        const nextStreaming = nextStatus === "parsing" || nextStatus === "building";
        setStatus(nextStatus);
        setIsStreaming(nextStreaming);
        syncPersistedSnapshot((snapshot) => ({
          ...snapshot,
          status: nextStatus,
          isStreaming: nextStreaming,
        }));
      }
    });
    unsubscribeStatusRef.current = wsClient.onStatusChange((wsStatus) => {
      const nextStatus = wsStatus === "connected" ? "connected" : "disconnected";
      setStatus(nextStatus);
      if (wsStatus !== "connected") {
        setIsStreaming(false);
      }
      syncPersistedSnapshot((snapshot) => ({
        ...snapshot,
        status: nextStatus,
        isStreaming: wsStatus === "connected" ? snapshot.isStreaming : false,
      }));
    });
    return () => {
      unsubscribeEventRef.current?.();
      unsubscribeEventRef.current = null;
      unsubscribeStatusRef.current?.();
      unsubscribeStatusRef.current = null;
    };
  }, [syncPersistedSnapshot, wsClient]);

  const attachFiles = useCallback((files: FileList | readonly File[]) => {
    const normalizedFiles = Array.from(files);
    setAttachments((current) => [
      ...current,
      ...normalizedFiles.map((file) => ({
        id: createMessageId(),
        name: file.name,
        sizeLabel: formatSize(file.size),
      })),
    ]);
  }, []);

  const sendPrompt = useCallback(async () => {
    const client = clientRef.current;
    if (client == null || draft.trim().length === 0) {
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
    syncFromClient(client, { planReady: false, executionReady: false, isStreaming: false });
  }, [attachments, draft, syncFromClient, wsClient]);

  const buildPlan = useCallback(async () => {
    const client = clientRef.current;
    if (client == null) {
      return;
    }
    wsClient?.publish({
      channel: "conversation",
      type: "build_plan",
      payload: { draft },
    });
    client.buildPlan(translateMessage("ui.conversation.generatedPlan"));
    syncFromClient(client, { planReady: true, executionReady: false, isStreaming: true, status: "building" });
  }, [draft, syncFromClient, wsClient]);

  const confirmPlan = useCallback(() => {
    const client = clientRef.current;
    if (client == null) {
      return;
    }
    client.confirm(translateMessage("ui.conversation.confirmedPlan"));
    syncFromClient(client, { planReady: true, executionReady: true, isStreaming: false, status: "confirming" });
  }, [syncFromClient]);

  const requestClarification = useCallback((content = translateMessage("ui.conversation.requestClarification.default")) => {
    const client = clientRef.current;
    if (client == null) {
      return;
    }
    wsClient?.publish({
      channel: "conversation",
      type: "clarification",
      payload: { content },
    });
    client.requestClarification(content);
    syncFromClient(client, { status: "waiting_clarification", isStreaming: false });
  }, [syncFromClient, wsClient]);

  const executePlan = useCallback(async () => {
    const client = clientRef.current;
    if (client == null) {
      return;
    }
    if (wsClient == null) {
      requestClarification(translateMessage("ui.conversation.execute.requiresConnection"));
      return;
    }
    if (!executionReady) {
      requestClarification();
      return;
    }
    wsClient.publish({
      channel: "conversation",
      type: "execute_plan",
      payload: {
        attachments: attachments.map((attachment) => attachment.name),
      },
    });
    client.execute(translateMessage("ui.conversation.execute.started"));
    if (typeof (client as { pushAssistant?: (content: string) => unknown; }).pushAssistant === "function") {
      (client as { pushAssistant: (content: string) => unknown; }).pushAssistant(translateMessage("ui.conversation.execute.completed"));
    }
    syncFromClient(client, { planReady: true, executionReady: true, isStreaming: false, status: "running" });
  }, [attachments, executionReady, requestClarification, syncFromClient, wsClient]);

  const disconnect = useCallback(() => {
    unsubscribeEventRef.current?.();
    unsubscribeEventRef.current = null;
    unsubscribeStatusRef.current?.();
    unsubscribeStatusRef.current = null;
    wsClient?.disconnect();
  }, [wsClient]);

  return useMemo(() => ({
    messages,
    attachments,
    status: status ?? "idle",
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
  }), [
    attachments,
    attachFiles,
    buildPlan,
    confirmPlan,
    disconnect,
    draft,
    executePlan,
    executionReady,
    isStreaming,
    messages,
    planReady,
    requestClarification,
    sendPrompt,
    status,
  ]);
}
