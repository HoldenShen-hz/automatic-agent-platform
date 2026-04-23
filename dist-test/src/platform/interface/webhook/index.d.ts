export type WebhookSignatureAlgorithm = "none" | "sha256_hmac";
export interface WebhookEndpointRegistration {
    endpointId: string;
    source: string;
    tenantId: string | null;
    workspaceId: string | null;
    enabled: boolean;
    allowedEventTypes: string[];
    algorithm: WebhookSignatureAlgorithm;
    signingSecret?: string;
    signatureHeader?: string;
    idempotencyHeader?: string;
    dispatchTargetRef?: string | null;
}
export interface InboundWebhookRequest {
    endpointId: string;
    headers: Record<string, string | string[] | undefined>;
    body: string;
    receivedAt?: string;
}
export type WebhookDispatchState = "accepted" | "duplicate";
export interface WebhookDispatchEnvelope {
    envelopeId: string;
    endpointId: string;
    source: string;
    tenantId: string | null;
    workspaceId: string | null;
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    dispatchTargetRef: string | null;
    receivedAt: string;
    acceptedAt: string;
    signatureVerified: boolean;
    dispatchState: WebhookDispatchState;
}
export declare class WebhookIngressService {
    private readonly endpoints;
    private readonly envelopesByIdempotencyKey;
    private readonly acceptedEnvelopes;
    private readonly failureCounts;
    registerEndpoint(input: WebhookEndpointRegistration): WebhookEndpointRegistration;
    receive(input: InboundWebhookRequest): WebhookDispatchEnvelope;
    listAcceptedEnvelopes(): WebhookDispatchEnvelope[];
    rollbackAcceptedEnvelope(endpointId: string, idempotencyKey: string, envelopeId: string): void;
    getEndpoint(endpointId: string): WebhookEndpointRegistration | null;
    deleteEndpoint(endpointId: string): boolean;
    listEndpoints(): WebhookEndpointRegistration[];
    recordDeliveryFailure(endpointId: string): WebhookEndpointRegistration | null;
    resetFailureCount(endpointId: string): void;
    getFailureCount(endpointId: string): number;
}
