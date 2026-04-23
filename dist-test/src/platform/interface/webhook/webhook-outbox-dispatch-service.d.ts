import type { OutboxRepository } from "../../shared/outbox/outbox-repository.js";
import type { InboundWebhookRequest, WebhookDispatchEnvelope, WebhookIngressService } from "./index.js";
export interface WebhookOutboxDispatchResult {
    readonly envelope: WebhookDispatchEnvelope;
    readonly duplicate: boolean;
    readonly persistedToOutbox: boolean;
    readonly outboxEntryId: string | null;
}
export declare class WebhookOutboxDispatchService {
    private readonly webhookIngressService;
    private readonly outboxRepository;
    constructor(webhookIngressService: WebhookIngressService, outboxRepository: OutboxRepository);
    receiveAndStage(input: InboundWebhookRequest & {
        traceId?: string | null;
    }): WebhookOutboxDispatchResult;
}
