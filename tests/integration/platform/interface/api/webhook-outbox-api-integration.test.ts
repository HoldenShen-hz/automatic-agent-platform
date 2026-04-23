import assert from "node:assert/strict";
import test from "node:test";

import { HttpApiServer } from "../../../../../src/platform/interface/api/http-api-server.js";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../../../../src/platform/interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

test("integration: public webhook receive endpoint stages accepted payload into outbox and de-duplicates repeats", async () => {
  const workspace = createTempWorkspace("aa-webhook-api-");
  try {
    const context = createSeededApiContext(workspace);
    const webhookIngressService = new WebhookIngressService();
    const outboxRepository = new OutboxRepository(context.db.connection);
    const webhookOutboxDispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);
    webhookIngressService.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["pull_request.opened"],
      algorithm: "none",
    });

    const server = new HttpApiServer({
      approvalService: context.approvalService,
      authService: context.authService,
      inspectService: context.inspectService,
      missionControlService: context.missionControlService,
      gatewayTargetDirectoryService: context.gatewayTargetDirectoryService,
      billingService: context.billingService,
      knowledgePlaneService: context.knowledgePlaneService,
      artifactPlaneService: context.artifactPlaneService,
      domainRegistryService: context.domainRegistryService,
      pluginRegistry: context.pluginRegistry,
      webhookIngressService,
      webhookOutboxDispatchService,
    });

    const first = await server.inject({
      method: "POST",
      url: "/v1/webhooks/github/receive",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-webhook-1",
      },
      body: JSON.stringify({
        eventType: "pull_request.opened",
        eventId: "evt-123",
        pullRequestId: 99,
      }),
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/webhooks/github/receive",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-webhook-2",
      },
      body: JSON.stringify({
        eventType: "pull_request.opened",
        eventId: "evt-123",
        pullRequestId: 99,
      }),
    });

    const firstPayload = first.json<{ data: { persistedToOutbox: boolean; duplicate: boolean } }>();
    const secondPayload = second.json<{ data: { persistedToOutbox: boolean; duplicate: boolean } }>();
    const pending = outboxRepository.listPendingEntries(10);

    assert.equal(first.statusCode, 202);
    assert.equal(firstPayload.data.persistedToOutbox, true);
    assert.equal(firstPayload.data.duplicate, false);
    assert.equal(second.statusCode, 200);
    assert.equal(secondPayload.data.persistedToOutbox, false);
    assert.equal(secondPayload.data.duplicate, true);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.eventType, "webhook.received");
    assert.match(pending[0]?.payloadJson ?? "", /pullRequestId/);
  } finally {
    cleanupPath(workspace);
  }
});
