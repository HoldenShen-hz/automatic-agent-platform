import assert from "node:assert/strict";
import test from "node:test";

import { WebhookOutboxDispatchService } from "../../../../../src/platform/five-plane-interface/webhook/webhook-outbox-dispatch-service.js";
import type {
  InboundWebhookRequest,
  WebhookDispatchEnvelope,
  WebhookIngressService,
} from "../../../../../src/platform/five-plane-interface/webhook/index.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";

// Mock implementations
class MockWebhookIngressService implements WebhookIngressService {
  private envelopes: Map<string, WebhookDispatchEnvelope> = new Map();
  private acceptedEnvelopes: WebhookDispatchEnvelope[] = [];
  private idCounter = 0;

  private generateId(): string {
    return `envelope-${Date.now()}-${++this.idCounter}`;
  }

  public registerEndpoint(): ReturnType<WebhookIngressService["registerEndpoint"]> {
    return {
      endpointId: "test-endpoint",
      source: "test-source",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    };
  }

  public receive(input: InboundWebhookRequest): WebhookDispatchEnvelope {
    const idempotencyKey =
      input.headers["idempotency-key"]?.toString() ??
      input.headers["x-idempotency-key"]?.toString() ??
      "default-key";

    const scopedKey = `${input.endpointId}:${idempotencyKey}`;

    // Check for duplicate
    const existing = this.envelopes.get(scopedKey);
    if (existing) {
      return { ...existing, dispatchState: "duplicate" };
    }

    // Parse payload from body
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(input.body);
    } catch {
      // Use empty payload if parsing fails
    }

    const eventType =
      (payload.eventType as string) ??
      (payload.event_type as string) ??
      (payload.type as string) ??
      "test.event";

    const envelope: WebhookDispatchEnvelope = {
      envelopeId: this.generateId(),
      endpointId: input.endpointId,
      source: "test-source",
      tenantId: null,
      workspaceId: null,
      eventType,
      idempotencyKey,
      payload,
      dispatchTargetRef: null,
      receivedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      signatureVerified: false,
      dispatchState: "accepted",
    };

    this.envelopes.set(scopedKey, envelope);
    this.acceptedEnvelopes.push(envelope);
    return envelope;
  }

  public rollbackAcceptedEnvelope(
    _endpointId: string,
    _idempotencyKey: string,
    _envelopeId: string,
  ): void {
    // No-op for testing
  }

  public listAcceptedEnvelopes(): WebhookDispatchEnvelope[] {
    return [...this.acceptedEnvelopes];
  }

  public getEndpoint(): ReturnType<WebhookIngressService["getEndpoint"]> {
    return null;
  }

  public deleteEndpoint(): boolean {
    return true;
  }

  public listEndpoints(): ReturnType<WebhookIngressService["listEndpoints"]> {
    return [];
  }

  public recordDeliveryFailure(): ReturnType<WebhookIngressService["recordDeliveryFailure"]> {
    return null;
  }

  public resetFailureCount(): void {
    // No-op
  }

  public getFailureCount(): number {
    return 0;
  }
}

class MockOutboxRepository implements Pick<OutboxRepository, "insertOutboxEntry"> {
  public insertedEntries: Array<{
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payloadJson: string;
    traceId: string | null;
    createdAt: string;
  }> = [];

  public insertOutboxEntry(
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payloadJson: string,
    traceId: string | null,
    createdAt: string,
  ) {
    const record = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      aggregateType,
      aggregateId,
      eventType,
      payloadJson,
      traceId,
      createdAt,
    };
    this.insertedEntries.push(record);
    return record;
  }
}

// Test suite
test.describe("WebhookOutboxDispatchService", () => {
  let mockIngressService: MockWebhookIngressService;
  let mockOutboxRepository: MockOutboxRepository;
  let service: WebhookOutboxDispatchService;

  test.beforeEach(() => {
    mockIngressService = new MockWebhookIngressService();
    mockOutboxRepository = new MockOutboxRepository();
    service = new WebhookOutboxDispatchService(mockIngressService, mockOutboxRepository);
  });

  test("receiveAndStage returns result with duplicate=false for new webhook", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "unique-key-1",
      },
      body: JSON.stringify({ eventType: "test.event", data: "test" }),
      traceId: "trace-123",
    };

    const result = service.receiveAndStage(input);

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.ok(result.outboxEntryId != null);
    assert.equal(result.envelope.dispatchState, "accepted");
    assert.equal(result.envelope.endpointId, "test-endpoint");
    assert.equal(result.envelope.idempotencyKey, "unique-key-1");
  });

  test("receiveAndStage returns result with duplicate=true for duplicate webhook", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "duplicate-key",
      },
      body: JSON.stringify({ eventType: "test.event", data: "test" }),
      traceId: "trace-456",
    };

    // First call
    const result1 = service.receiveAndStage(input);
    assert.equal(result1.duplicate, false);
    assert.equal(result1.persistedToOutbox, true);

    // Second call with same idempotency key
    const result2 = service.receiveAndStage(input);
    assert.equal(result2.duplicate, true);
    assert.equal(result2.persistedToOutbox, false);
    assert.equal(result2.outboxEntryId, null);
    assert.equal(result2.envelope.dispatchState, "duplicate");
  });

  test("receiveAndStage persists correct data to outbox", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "endpoint-abc",
      headers: {
        "content-type": "application/json",
        "x-custom-header": "value",
      },
      body: JSON.stringify({ eventType: "order.created", orderId: "12345" }),
      traceId: "trace-789",
    };

    service.receiveAndStage(input);

    assert.equal(mockOutboxRepository.insertedEntries.length, 1);
    const entry = mockOutboxRepository.insertedEntries[0]!;
    assert.equal(entry.aggregateType, "webhook_endpoint");
    assert.equal(entry.aggregateId, "endpoint-abc");
    assert.equal(entry.eventType, "webhook.received");
    assert.equal(entry.traceId, "trace-789");

    const payload = JSON.parse(entry.payloadJson);
    assert.equal(payload.ingestionSurface, "webhook_ingress");
    assert.ok(payload.envelope);
    assert.equal(payload.envelope.endpointId, "endpoint-abc");
  });

  test("receiveAndStage handles null traceId", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ eventType: "test.event" }),
      traceId: null,
    };

    const result = service.receiveAndStage(input);

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.equal(mockOutboxRepository.insertedEntries[0]!.traceId, null);
  });

  test("receiveAndStage handles undefined traceId", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ eventType: "test.event" }),
    };

    const result = service.receiveAndStage(input);

    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.equal(mockOutboxRepository.insertedEntries[0]!.traceId, null);
  });

  test("receiveAndStage includes correct envelope fields in result", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "my-endpoint",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "envelope-test-key",
      },
      body: JSON.stringify({ eventType: "payment.completed", amount: 100 }),
    };

    const result = service.receiveAndStage(input);

    assert.equal(result.envelope.envelopeId.startsWith("envelope-"), true);
    assert.equal(result.envelope.endpointId, "my-endpoint");
    assert.equal(result.envelope.source, "test-source");
    assert.equal(result.envelope.eventType, "payment.completed");
    assert.equal(result.envelope.idempotencyKey, "envelope-test-key");
    assert.equal(result.envelope.tenantId, null);
    assert.equal(result.envelope.workspaceId, null);
    assert.equal(result.envelope.dispatchState, "accepted");
    assert.equal(result.envelope.signatureVerified, false);
  });

  test("receiveAndStage uses idempotency key from header", () => {
    const input1: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "header-key-1",
      },
      body: JSON.stringify({ eventType: "test.event" }),
    };

    const input2: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "header-key-2",
      },
      body: JSON.stringify({ eventType: "test.event" }),
    };

    const result1 = service.receiveAndStage(input1);
    const result2 = service.receiveAndStage(input2);

    // Different idempotency keys, so both should be non-duplicate
    assert.equal(result1.duplicate, false);
    assert.equal(result2.duplicate, false);
    assert.notEqual(result1.envelope.idempotencyKey, result2.envelope.idempotencyKey);
  });

  test("receiveAndStage handles multiple different endpoints independently", () => {
    const input1: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "endpoint-1",
      headers: { "idempotency-key": "same-key" },
      body: JSON.stringify({ eventType: "test.event" }),
    };

    const input2: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "endpoint-2",
      headers: { "idempotency-key": "same-key" },
      body: JSON.stringify({ eventType: "test.event" }),
    };

    const result1 = service.receiveAndStage(input1);
    const result2 = service.receiveAndStage(input2);

    // Same idempotency key but different endpoints, so both should be non-duplicate
    assert.equal(result1.duplicate, false);
    assert.equal(result2.duplicate, false);
    assert.notEqual(result1.envelope.envelopeId, result2.envelope.envelopeId);
  });

  test("receiveAndStage creates outbox entries with correct aggregate_type", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: { "idempotency-key": "aggregate-test" },
      body: JSON.stringify({ eventType: "test.event" }),
    };

    service.receiveAndStage(input);

    assert.equal(mockOutboxRepository.insertedEntries.length, 1);
    assert.equal(mockOutboxRepository.insertedEntries[0]!.aggregateType, "webhook_endpoint");
    assert.equal(mockOutboxRepository.insertedEntries[0]!.aggregateId, "test-endpoint");
  });

  test("receiveAndStage envelope contains payload from webhook body", () => {
    const input: InboundWebhookRequest & { traceId?: string | null } = {
      endpointId: "test-endpoint",
      headers: { "idempotency-key": "payload-test" },
      body: JSON.stringify({
        eventType: "order.updated",
        orderId: "order-123",
        status: "shipped",
        items: [{ sku: "ABC", quantity: 2 }],
      }),
    };

    const result = service.receiveAndStage(input);

    assert.equal(result.envelope.payload.eventType, "order.updated");
    assert.equal(result.envelope.payload.orderId, "order-123");
    assert.equal(result.envelope.payload.status, "shipped");
    assert.deepEqual(result.envelope.payload.items, [{ sku: "ABC", quantity: 2 }]);
  });
});
