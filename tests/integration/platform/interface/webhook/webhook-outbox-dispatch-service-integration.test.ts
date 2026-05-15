import assert from "node:assert/strict";
import test from "node:test";

import { WebhookIngressService } from "../../../../../src/platform/five-plane-interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/five-plane-interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";
import { createHmac } from "node:crypto";

function makeSignature(body: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

test("integration: WebhookOutboxDispatchService stages webhook envelope into outbox on receive", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "github-pr",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const result = dispatchService.receiveAndStage({
      endpointId: "github-pr",
      headers: {},
      body: JSON.stringify({
        eventType: "pull_request.opened",
        eventId: "evt-dispatch-1",
        prId: 42,
      }),
    });

    assert.equal(result.envelope.endpointId, "github-pr");
    assert.equal(result.envelope.eventType, "pull_request.opened");
    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
    assert.ok(result.outboxEntryId != null);

    const pendingEntries = outboxRepository.listPendingEntries(10);
    const webhookEntry = pendingEntries.find(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "github-pr",
    );
    assert.ok(webhookEntry != null, "Should have a pending outbox entry for the webhook");
    assert.equal(webhookEntry.eventType, "webhook.received");
    assert.match(webhookEntry.payloadJson, /pull_request.opened/);
    assert.match(webhookEntry.payloadJson, /evt-dispatch-1/);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService returns duplicate result for repeated idempotency key", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-dedup-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "dedup-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const body = JSON.stringify({
      eventType: "ping",
      eventId: "dedup-id-123",
    });

    const first = dispatchService.receiveAndStage({
      endpointId: "dedup-ep",
      headers: {},
      body,
    });

    const second = dispatchService.receiveAndStage({
      endpointId: "dedup-ep",
      headers: {},
      body,
    });

    assert.equal(first.duplicate, false);
    assert.equal(first.persistedToOutbox, true);
    assert.ok(first.outboxEntryId != null);

    assert.equal(second.duplicate, true);
    assert.equal(second.persistedToOutbox, false);
    assert.equal(second.outboxEntryId, null);

    // Only one outbox entry should exist
    const pendingEntries = outboxRepository.listPendingEntries(10);
    const webhookEntries = pendingEntries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "dedup-ep",
    );
    assert.equal(webhookEntries.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService rolls back envelope on outbox failure", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-rollback-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();

    // Create a mock outbox repository that throws on insert
    const failingOutboxRepository = new OutboxRepository(context.db.connection);
    const originalInsert = failingOutboxRepository.insertOutboxEntry.bind(failingOutboxRepository);
    failingOutboxRepository.insertOutboxEntry = () => {
      throw new Error("Outbox write failure");
    };

    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, failingOutboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "failing-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "failing-ep",
          headers: {},
          body: JSON.stringify({
            eventType: "test",
            eventId: "rollback-test",
          }),
        }),
      { message: "Outbox write failure" },
    );

    // Verify envelope was rolled back - no accepted envelopes should exist
    const envelopes = webhookIngressService.listAcceptedEnvelopes();
    const rolledBackEnvelope = envelopes.find(
      (e) => e.idempotencyKey === "rollback-test" && e.endpointId === "failing-ep",
    );
    assert.equal(rolledBackEnvelope, undefined, "Envelope should have been rolled back after outbox failure");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService preserves signature verification through staging", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-sig-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    const secret = "webhook-signing-secret-abc123";
    webhookIngressService.registerEndpoint({
      endpointId: "signed-webhook",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "sha256_hmac",
      signingSecret: secret,
      signatureHeader: "x-hub-signature-256",
    });

    const body = JSON.stringify({
      eventType: "push",
      eventId: "sig-test-456",
    });
    const signature = makeSignature(body, secret);

    const result = dispatchService.receiveAndStage({
      endpointId: "signed-webhook",
      headers: { "x-hub-signature-256": signature },
      body,
    });

    assert.equal(result.envelope.signatureVerified, true);
    assert.equal(result.envelope.dispatchState, "accepted");
    assert.equal(result.duplicate, false);
    assert.equal(result.persistedToOutbox, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService rejects invalid signature before staging", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-badsig-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "bad-sig-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "sha256_hmac",
      signingSecret: "correct-secret",
    });

    const body = JSON.stringify({
      eventType: "push",
      eventId: "bad-sig-test",
    });

    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "bad-sig-ep",
          headers: { "x-hub-signature-256": "sha256=wrongsignature" },
          body,
        }),
      { code: "webhook.signature_required" },
    );

    // No outbox entry should exist for failed signature verification
    const pendingEntries = outboxRepository.listPendingEntries(10);
    const webhookEntries = pendingEntries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "bad-sig-ep",
    );
    assert.equal(webhookEntries.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService rejects invalid signature when header is present", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-badsig-present-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "bad-sig-present-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "sha256_hmac",
      signingSecret: "correct-secret",
      signatureHeader: "x-hub-signature-256",
    });

    const body = JSON.stringify({
      eventType: "push",
      eventId: "bad-sig-present-test",
    });

    // The endpoint has explicit signatureHeader "x-hub-signature-256" and we pass the header
    // with wrong signature value -> signature_invalid
    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "bad-sig-present-ep",
          headers: { "x-hub-signature-256": "sha256=wrongsignature" },
          body,
        }),
      { code: "webhook.signature_invalid" },
    );

    // No outbox entry should exist for failed signature verification
    const pendingEntries = outboxRepository.listPendingEntries(10);
    const webhookEntries = pendingEntries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "bad-sig-present-ep",
    );
    assert.equal(webhookEntries.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService attaches traceId to outbox entry when provided", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-trace-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "trace-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    const result = dispatchService.receiveAndStage({
      endpointId: "trace-ep",
      headers: {},
      body: JSON.stringify({
        eventType: "ping",
        eventId: "trace-test-789",
      }),
      traceId: "trace-abc-123-xyz",
    });

    assert.equal(result.persistedToOutbox, true);

    const pendingEntries = outboxRepository.listPendingEntries(10);
    const webhookEntry = pendingEntries.find(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "trace-ep",
    );
    assert.ok(webhookEntry != null);
    assert.equal(webhookEntry.traceId, "trace-abc-123-xyz");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService rejects unknown endpoint", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-unknown-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "nonexistent-endpoint",
          headers: {},
          body: JSON.stringify({
            eventType: "test",
            eventId: "unknown-ep-test",
          }),
        }),
      { code: "webhook.endpoint_not_found" },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService rejects disabled endpoint", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-disabled-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "disabled-webhook-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: false,
      allowedEventTypes: [],
      algorithm: "none",
    });

    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "disabled-webhook-ep",
          headers: {},
          body: JSON.stringify({
            eventType: "test",
            eventId: "disabled-ep-test",
          }),
        }),
      { code: "webhook.endpoint_disabled" },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService filters disallowed event types", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-filter-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "filtered-webhook-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["allowed.event"],
      algorithm: "none",
    });

    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "filtered-webhook-ep",
          headers: {},
          body: JSON.stringify({
            eventType: "forbidden.event",
            eventId: "filtered-test",
          }),
        }),
      { code: "webhook.event_type_not_allowed" },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: WebhookOutboxDispatchService requires idempotency key", async () => {
  const workspace = createTempWorkspace("aa-webhook-dispatch-noidem-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const dispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "no-idem-ep",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: [],
      algorithm: "none",
    });

    assert.throws(
      () =>
        dispatchService.receiveAndStage({
          endpointId: "no-idem-ep",
          headers: {},
          body: JSON.stringify({
            eventType: "test",
          }),
        }),
      { code: "webhook.idempotency_key_required" },
    );
  } finally {
    cleanupPath(workspace);
  }
});