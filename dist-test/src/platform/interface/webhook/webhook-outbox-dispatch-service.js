export class WebhookOutboxDispatchService {
    webhookIngressService;
    outboxRepository;
    constructor(webhookIngressService, outboxRepository) {
        this.webhookIngressService = webhookIngressService;
        this.outboxRepository = outboxRepository;
    }
    receiveAndStage(input) {
        const envelope = this.webhookIngressService.receive(input);
        if (envelope.dispatchState === "duplicate") {
            return {
                envelope,
                duplicate: true,
                persistedToOutbox: false,
                outboxEntryId: null,
            };
        }
        try {
            const record = this.outboxRepository.insertOutboxEntry("webhook_endpoint", envelope.endpointId, "webhook.received", JSON.stringify({
                envelope,
                ingestionSurface: "webhook_ingress",
            }), input.traceId ?? null, envelope.acceptedAt);
            return {
                envelope,
                duplicate: false,
                persistedToOutbox: true,
                outboxEntryId: record.id,
            };
        }
        catch (error) {
            this.webhookIngressService.rollbackAcceptedEnvelope(envelope.endpointId, envelope.idempotencyKey, envelope.envelopeId);
            throw error;
        }
    }
}
//# sourceMappingURL=webhook-outbox-dispatch-service.js.map