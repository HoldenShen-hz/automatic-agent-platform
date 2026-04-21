export interface RequestEnvelope<TBody = Record<string, unknown>> {
    envelopeId: string;
    requestId: string;
    taskId: string | null;
    tenantId: string | null;
    sessionId: string | null;
    traceId: string | null;
    mode: "sync" | "async";
    body: TBody;
    createdAt: string;
}
export declare function createRequestEnvelope<TBody>(input: Omit<RequestEnvelope<TBody>, "envelopeId" | "createdAt"> & {
    envelopeId?: string;
    createdAt?: string;
}): RequestEnvelope<TBody>;
