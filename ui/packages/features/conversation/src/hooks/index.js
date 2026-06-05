import { createTask } from "@aa/shared-api-client";
import { ConversationClient } from "@aa/shared-nl-client";
import { translateMessage } from "@aa/shared-i18n";
import { useRestClient } from "@aa/shared-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
const STORAGE_KEY = "aa.conversation.vm";
export const conversationVmQueryKey = ["conversation", "vm"];
const TASK_COMPLETION_POLL_INTERVAL_MS = 2_000;
const TASK_COMPLETION_TIMEOUT_MS = 120_000;
const RESTORABLE_CONVERSATION_TTL_MS = 30 * 60 * 1000;
class ConversationVmCache {
    value = null;
    setQueryData(_key, nextValue) {
        this.value = nextValue;
    }
    getQueryData(_key) {
        return this.value;
    }
    clear() {
        this.value = null;
    }
}
export const conversationVmQueryClient = new ConversationVmCache();
function normalizeMessageRole(role) {
    return role ?? "assistant";
}
function createMessageId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `msg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
function createMessage(role, content, timestamp = new Date().toISOString()) {
    return {
        id: createMessageId(),
        role: normalizeMessageRole(role),
        content: content ?? "",
        timestamp,
    };
}
function formatSize(bytes) {
    if (bytes >= 1024 * 1024) {
        return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
    }
    if (bytes >= 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${bytes} B`;
}
function mapConversationMessages(messages) {
    return messages.map((message, index) => ({
        id: message.id ?? `msg-${index + 1}`,
        role: normalizeMessageRole(message.role),
        content: message.content ?? "",
        timestamp: new Date().toISOString(),
    }));
}
function createDefaultPersistedState() {
    return {
        messages: [],
        attachments: [],
        status: "idle",
        planReady: false,
        executionReady: false,
        isStreaming: false,
        updatedAt: new Date().toISOString(),
    };
}
function loadInitialConversationState() {
    const restoredState = readPersistedState();
    if (restoredState != null && shouldRestorePersistedState(restoredState)) {
        return {
            state: restoredState,
            restored: true,
        };
    }
    clearPersistedState();
    return {
        state: createDefaultPersistedState(),
        restored: false,
    };
}
function persistState(state) {
    conversationVmQueryClient.setQueryData(conversationVmQueryKey, state);
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch {
        // Query cache remains authoritative when browser storage is unavailable.
    }
}
function readPersistedState() {
    const cached = conversationVmQueryClient.getQueryData(conversationVmQueryKey);
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
        const parsed = JSON.parse(raw);
        return {
            ...createDefaultPersistedState(),
            ...(Array.isArray(parsed.messages) ? { messages: parsed.messages } : {}),
            ...(Array.isArray(parsed.attachments) ? { attachments: parsed.attachments } : {}),
            ...(typeof parsed.status === "string" ? { status: parsed.status } : {}),
            ...(typeof parsed.planReady === "boolean" ? { planReady: parsed.planReady } : {}),
            ...(typeof parsed.executionReady === "boolean" ? { executionReady: parsed.executionReady } : {}),
            ...(typeof parsed.isStreaming === "boolean" ? { isStreaming: parsed.isStreaming } : {}),
            ...(typeof parsed.updatedAt === "string" ? { updatedAt: parsed.updatedAt } : {}),
        };
    }
    catch {
        return null;
    }
}
function clearPersistedState() {
    conversationVmQueryClient.clear();
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    }
    catch {
        // Ignore storage cleanup failures and fall back to the in-memory cache reset above.
    }
}
function shouldRestorePersistedState(state) {
    const updatedAt = Date.parse(state.updatedAt);
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > RESTORABLE_CONVERSATION_TTL_MS) {
        return false;
    }
    return state.status === "building"
        || state.status === "confirming"
        || state.status === "running"
        || state.status === "waiting_clarification";
}
function createConversationClient(persisted, onStateChange) {
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
function resolveClientSnapshot(client, fallbackStatus) {
    if (typeof client.getSnapshot === "function") {
        return client.getSnapshot();
    }
    return {
        messages: typeof client.listMessages === "function"
            ? client.listMessages()
            : [],
        status: typeof client.getStatus === "function"
            ? client.getStatus()
            : fallbackStatus,
    };
}
function preferTransportStatus(currentStatus, snapshotStatus) {
    if (snapshotStatus == null) {
        return currentStatus;
    }
    if (snapshotStatus === "idle"
        && (currentStatus === "connected" || currentStatus === "disconnected")) {
        return currentStatus;
    }
    return snapshotStatus;
}
function normalizeTaskCompletionStatus(status) {
    switch (status) {
        case "completed":
        case "done":
            return "completed";
        case "failed":
        case "timed_out":
        case "superseded":
        case "cancelled":
            return "failed";
        default:
            return null;
    }
}
function parseTaskOutputMetadata(outputJson) {
    if (typeof outputJson !== "string" || outputJson.trim().length === 0) {
        return {};
    }
    try {
        const parsed = JSON.parse(outputJson);
        return {
            ...(parsed.outputSummary === undefined ? {} : { outputSummary: parsed.outputSummary }),
            ...(parsed.outputUri === undefined ? {} : { outputUri: parsed.outputUri }),
        };
    }
    catch {
        return {};
    }
}
export function useConversationVm(wsClient) {
    const restClient = useRestClient();
    const defaultDraft = translateMessage("ui.conversation.defaultDraft");
    const initialConversationStateRef = useRef(null);
    if (initialConversationStateRef.current == null) {
        initialConversationStateRef.current = loadInitialConversationState();
    }
    const initialState = initialConversationStateRef.current.state;
    const [messages, setMessages] = useState(initialState.messages);
    const [attachments, setAttachments] = useState(initialState.attachments);
    const [status, setStatus] = useState(initialState.status);
    const [draft, setDraft] = useState(defaultDraft);
    const [planReady, setPlanReady] = useState(initialState.planReady);
    const [executionReady, setExecutionReady] = useState(initialState.executionReady);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isStreaming, setIsStreaming] = useState(initialState.isStreaming);
    const bootstrapDraftRef = useRef(false);
    const persistTimeoutRef = useRef(null);
    const stateRef = useRef(initialState);
    const clientRef = useRef(null);
    const clientLifecycleActiveRef = useRef(false);
    const unsubscribeEventRef = useRef(null);
    const unsubscribeStatusRef = useRef(null);
    const activeExecutionTaskIdRef = useRef(null);
    const executionInFlightRef = useRef(false);
    const syncPersistedSnapshot = useCallback((updater) => {
        const nextState = {
            ...updater(stateRef.current),
            updatedAt: new Date().toISOString(),
        };
        stateRef.current = nextState;
        persistState(nextState);
    }, []);
    const syncFromClient = useCallback((client, overrides) => {
        const snapshot = resolveClientSnapshot(client, stateRef.current.status);
        const currentState = stateRef.current;
        const nextMessages = snapshot.messages != null ? mapConversationMessages(snapshot.messages) : currentState.messages;
        const nextStatus = overrides?.status ?? preferTransportStatus(currentState.status, snapshot.status);
        const nextPlanReady = overrides?.planReady ?? snapshot.planReady ?? currentState.planReady;
        const nextExecutionReady = overrides?.executionReady ?? snapshot.executionReady ?? currentState.executionReady;
        const nextIsStreaming = overrides?.isStreaming ?? snapshot.isStreaming ?? currentState.isStreaming;
        const nextState = {
            messages: nextMessages,
            attachments: currentState.attachments,
            status: nextStatus,
            planReady: nextPlanReady,
            executionReady: nextExecutionReady,
            isStreaming: nextIsStreaming,
            updatedAt: new Date().toISOString(),
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
        const persisted = initialConversationStateRef.current?.state ?? createDefaultPersistedState();
        const restored = initialConversationStateRef.current?.restored ?? false;
        stateRef.current = persisted;
        clientLifecycleActiveRef.current = true;
        const client = createConversationClient(persisted, (snapshot) => {
            if (!clientLifecycleActiveRef.current) {
                return;
            }
            const nextStatus = preferTransportStatus(stateRef.current.status, snapshot.status);
            const nextMessages = snapshot.messages != null ? mapConversationMessages(snapshot.messages) : stateRef.current.messages;
            const nextPlanReady = snapshot.planReady ?? stateRef.current.planReady;
            const nextExecutionReady = snapshot.executionReady ?? stateRef.current.executionReady;
            const nextIsStreaming = snapshot.isStreaming ?? stateRef.current.isStreaming;
            if (snapshot.messages != null) {
                setMessages(nextMessages);
            }
            setStatus(nextStatus);
            if (snapshot.planReady != null) {
                setPlanReady(nextPlanReady);
            }
            if (snapshot.executionReady != null) {
                setExecutionReady(nextExecutionReady);
            }
            if (snapshot.isStreaming != null) {
                setIsStreaming(nextIsStreaming);
            }
            stateRef.current = {
                ...stateRef.current,
                messages: nextMessages,
                status: nextStatus,
                planReady: nextPlanReady,
                executionReady: nextExecutionReady,
                isStreaming: nextIsStreaming,
            };
        });
        clientRef.current = client;
        if (!restored) {
            syncFromClient(client);
        }
        else {
            persistState(stateRef.current);
        }
        return () => {
            if (persistTimeoutRef.current != null) {
                clearTimeout(persistTimeoutRef.current);
                persistTimeoutRef.current = null;
            }
            clientLifecycleActiveRef.current = false;
            persistState(stateRef.current);
            try {
                client.dispose?.();
            }
            catch {
                // Disposal is best-effort and should not break unmount cleanup.
            }
            clientRef.current = null;
        };
    }, [syncFromClient]);
    useEffect(() => {
        if (bootstrapDraftRef.current) {
            return;
        }
        bootstrapDraftRef.current = true;
        if (draft.trim().length === 0 && !initialConversationStateRef.current?.restored) {
            setDraft(defaultDraft);
        }
    }, [defaultDraft, draft]);
    useEffect(() => {
        const nextState = {
            messages,
            attachments,
            status,
            planReady,
            executionReady,
            isStreaming,
            updatedAt: new Date().toISOString(),
        };
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
        unsubscribeEventRef.current = wsClient.subscribe("conversation", (event) => {
            const payload = event.payload;
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
            }
            else if (payload.content != null) {
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
    const attachFiles = useCallback((files) => {
        const normalizedFiles = Array.from(files);
        setAttachments((current) => [
            ...current,
            ...normalizedFiles.map((file) => ({
                id: createMessageId(),
                name: file.name,
                sizeLabel: formatSize(file.size),
            })),
        ]);
        syncPersistedSnapshot((snapshot) => ({
            ...snapshot,
            attachments: [
                ...snapshot.attachments,
                ...normalizedFiles.map((file) => ({
                    id: createMessageId(),
                    name: file.name,
                    sizeLabel: formatSize(file.size),
                })),
            ],
        }));
    }, [syncPersistedSnapshot]);
    const appendConversationMessage = useCallback((role, content) => {
        setMessages((current) => {
            const nextMessages = [...current, createMessage(role, content)];
            syncPersistedSnapshot((snapshot) => ({ ...snapshot, messages: nextMessages }));
            return nextMessages;
        });
    }, [syncPersistedSnapshot]);
    const resolveExecutionPrompt = useCallback(() => {
        const normalizedDraft = draft.trim();
        if (normalizedDraft.length > 0) {
            return normalizedDraft;
        }
        const latestUserMessage = [...messages].reverse().find((message) => message.role === "user" && message.content.trim().length > 0);
        return latestUserMessage?.content.trim() ?? "";
    }, [draft, messages]);
    const waitForRealTaskCompletion = useCallback(async (taskId) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= TASK_COMPLETION_TIMEOUT_MS) {
            const cockpit = await restClient.get(`/v1/tasks/${encodeURIComponent(taskId)}`);
            const rawTask = cockpit.snapshot?.task;
            const normalizedStatus = normalizeTaskCompletionStatus(rawTask?.status);
            if (normalizedStatus != null) {
                return {
                    status: normalizedStatus,
                    ...parseTaskOutputMetadata(rawTask?.outputJson),
                };
            }
            await new Promise((resolve) => setTimeout(resolve, TASK_COMPLETION_POLL_INTERVAL_MS));
        }
        throw new Error("conversation.real_task_timeout");
    }, [restClient]);
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
        const conversationClient = clientRef.current;
        if (conversationClient == null) {
            return;
        }
        if (executionInFlightRef.current) {
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
        const executionPrompt = resolveExecutionPrompt();
        if (executionPrompt.length === 0) {
            requestClarification(translateMessage("ui.conversation.execute.requiresConnection"));
            return;
        }
        executionInFlightRef.current = true;
        setIsExecuting(true);
        setStatus("running");
        setExecutionReady(false);
        setIsStreaming(true);
        syncPersistedSnapshot((snapshot) => ({
            ...snapshot,
            status: "running",
            isStreaming: true,
            planReady: true,
            executionReady: false,
        }));
        appendConversationMessage("system", translateMessage("ui.conversation.execute.started"));
        let submittedTaskId = null;
        try {
            const created = await createTask(restClient, {
                title: executionPrompt,
                divisionId: "platform",
            });
            const taskId = created.snapshot?.task?.id;
            if (taskId == null || taskId.length === 0) {
                throw new Error("conversation.real_task_missing_id");
            }
            submittedTaskId = taskId;
            activeExecutionTaskIdRef.current = taskId;
            appendConversationMessage("system", `real task submitted: ${taskId}`);
            const completedTask = await waitForRealTaskCompletion(taskId);
            if (activeExecutionTaskIdRef.current !== taskId) {
                return;
            }
            if (completedTask.status === "completed") {
                appendConversationMessage("assistant", completedTask.outputSummary
                    ?? completedTask.outputUri
                    ?? translateMessage("ui.taskCockpit.value.noRealOutput"));
                setStatus("connected");
                setIsStreaming(false);
                syncPersistedSnapshot((snapshot) => ({
                    ...snapshot,
                    status: "connected",
                    isStreaming: false,
                    planReady: false,
                    executionReady: false,
                }));
                return;
            }
            appendConversationMessage("system", completedTask.outputSummary ?? "real task execution failed");
            setStatus("error");
            setIsStreaming(false);
            syncPersistedSnapshot((snapshot) => ({
                ...snapshot,
                status: "error",
                isStreaming: false,
                planReady: false,
                executionReady: false,
            }));
        }
        catch (error) {
            appendConversationMessage("system", error instanceof Error ? error.message : String(error));
            setStatus("error");
            setIsStreaming(false);
            syncPersistedSnapshot((snapshot) => ({
                ...snapshot,
                status: "error",
                isStreaming: false,
                planReady: false,
                executionReady: false,
            }));
        }
        finally {
            if (submittedTaskId == null || activeExecutionTaskIdRef.current === submittedTaskId) {
                activeExecutionTaskIdRef.current = null;
            }
            executionInFlightRef.current = false;
            setIsExecuting(false);
        }
    }, [appendConversationMessage, executionReady, requestClarification, resolveExecutionPrompt, restClient, syncPersistedSnapshot, waitForRealTaskCompletion, wsClient]);
    const disconnect = useCallback(() => {
        unsubscribeEventRef.current?.();
        unsubscribeEventRef.current = null;
        unsubscribeStatusRef.current?.();
        unsubscribeStatusRef.current = null;
        wsClient?.disconnect();
    }, [wsClient]);
    const restoreSuggestedDraft = useCallback(() => {
        setDraft(defaultDraft);
    }, [defaultDraft]);
    return useMemo(() => ({
        messages,
        attachments,
        status: status ?? "idle",
        draft,
        planReady,
        executionReady,
        isExecuting,
        isStreaming,
        setDraft,
        restoreSuggestedDraft,
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
        isExecuting,
        isStreaming,
        messages,
        planReady,
        restoreSuggestedDraft,
        requestClarification,
        sendPrompt,
        status,
    ]);
}
