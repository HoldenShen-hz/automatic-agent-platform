import type { OutboxRepository } from "../../shared/outbox/outbox-repository.js";

import type { InboundWebhookRequest, WebhookDispatchEnvelope, WebhookIngressService } from "./index.js";

export interface WebhookOutboxDispatchResult {
  readonly envelope: WebhookDispatchEnvelope;
  readonly duplicate: boolean;
  readonly persistedToOutbox: boolean;
  readonly outboxEntryId: string | null;
}

export class WebhookOutboxDispatchService {
  public constructor(
    private readonly webhookIngressService: WebhookIngressService,
    private readonly outboxRepository: OutboxRepository,
  ) {}

  public receiveAndStage(
    input: InboundWebhookRequest & { traceId?: string | null },
  ): WebhookOutboxDispatchResult {
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
      const record = this.outboxRepository.insertOutboxEntry(
        "webhook_endpoint",
        envelope.endpointId,
        "webhook.received",
        JSON.stringify({
          envelope,
          ingestionSurface: "webhook_ingress",
        }),
        input.traceId ?? null,
        envelope.acceptedAt,
      );
      return {
        envelope,
        duplicate: false,
        persistedToOutbox: true,
        outboxEntryId: record.id,
      };
    } catch (error) {
      this.webhookIngressService.rollbackAcceptedEnvelope(
        envelope.endpointId,
        envelope.idempotencyKey,
        envelope.envelopeId,
      );
      throw error;
    }
  }
}
