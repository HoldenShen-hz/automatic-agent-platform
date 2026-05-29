export type ConversationStatus = "idle" | "parsing" | "clarifying" | "building" | "confirming" | "executing" | "reporting";
export interface ConversationMessage {
    readonly id: string;
    readonly role: "user" | "assistant" | "system";
    readonly content: string;
}
export interface ConversationSnapshot {
    readonly messages: readonly ConversationMessage[];
    readonly status: ConversationStatus;
    readonly planReady: boolean;
    readonly isStreaming: boolean;
}
export interface ConversationClientOptions {
    readonly initialMessages?: readonly ConversationMessage[];
    readonly transport?: {
        subscribe(channel: string, handler: (event: {
            type: string;
            payload: unknown;
        }) => void): () => void;
    };
    readonly userId?: string;
    readonly onStateChange?: (snapshot: ConversationSnapshot) => void;
}
export declare class ConversationClient {
    private readonly options;
    private readonly messages;
    private status;
    private planReady;
    private isStreaming;
    private readonly unsubscribers;
    constructor(options?: ConversationClientOptions);
    listMessages(): readonly ConversationMessage[];
    getStatus(): ConversationStatus;
    send(content: string): ConversationMessage;
    pushAssistant(content: string): ConversationMessage;
    requestClarification(content: string): ConversationMessage;
    buildPlan(content: string): ConversationMessage;
    confirm(content: string): ConversationMessage;
    execute(content: string): ConversationMessage;
    getSnapshot(): ConversationSnapshot;
    dispose(): void;
    private emitStateChange;
}
