export interface ModelMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
}
export interface ModelRequest {
    requestId: string;
    model: string;
    messages: ModelMessage[];
    temperature: number | null;
    maxTokens: number | null;
    tenantId: string | null;
    taskId: string | null;
    createdAt: string;
}
export declare function createModelRequest(input: Omit<ModelRequest, "requestId" | "createdAt"> & {
    requestId?: string;
    createdAt?: string;
}): ModelRequest;
