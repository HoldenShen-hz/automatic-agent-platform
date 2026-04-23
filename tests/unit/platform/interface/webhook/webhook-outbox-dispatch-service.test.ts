import assert from "node:assert/strict";
import test from "node:test";

import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";

test("WebhookOutboxDispatchService writes accepted webhook envelopes into outbox and de-duplicates repeats", () => {
  const workspace = createTempWorkspace("aa-webhook-outbox-");
  try {
    const db = new SqliteDatabase(`${workspace}/webhook.db`);
    db.migrate();
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(db.connection);
    const service = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

    webhookIngressService.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      enabled: true,
      allowedEventTypes: ["pull_request.opened"],
      algorithm: "none",
    });

    const first = service.receiveAndStage({
      endpointId: "github",
      headers: {},
      body: JSON.stringify({
        eventType: "pull_request.opened",
        eventId: "evt-1",
        repository: "automatic_agent_platform",
      }),
      traceId: "trace-1",
    });
    const second = service.receiveAndStage({
      endpointId: "github",
      headers: {},
      body: JSON.stringify({
        eventType: "pull_request.opened",
        eventId: "evt-1",
        repository: "automatic_agent_platform",
      }),
      traceId: "trace-2",
    });

    const pending = outboxRepository.listPendingEntries(10);
    assert.equal(first.duplicate, false);
    assert.equal(first.persistedToOutbox, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.persistedToOutbox, false);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.aggregateType, "webhook_endpoint");
    assert.equal(pending[0]?.aggregateId, "github");
    assert.equal(pending[0]?.eventType, "webhook.received");
    assert.match(pending[0]?.payloadJson ?? "", /pull_request\.opened/);
  } finally {
    cleanupPath(workspace);
  }
});
