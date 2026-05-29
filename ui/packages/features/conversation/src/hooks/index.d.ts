import { type ConversationStatus } from "@aa/shared-nl-client";
import type { WSClient } from "@aa/shared-api-client";
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
export declare const conversationVmQueryKey: readonly ["conversation", "vm"];
declare class ConversationVmCache {
    private value;
    setQueryData(_key: typeof conversationVmQueryKey, nextValue: PersistedConversationState): void;
    getQueryData<T>(_key: typeof conversationVmQueryKey): T | undefined;
    clear(): void;
}
export declare const conversationVmQueryClient: ConversationVmCache;
export declare function useConversationVm(wsClient?: WSClient | null): ConversationVm;
export {};
