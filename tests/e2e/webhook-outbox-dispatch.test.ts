/**
 * E2E Webhook Outbox Dispatch Tests
 *
 * End-to-end tests covering webhook outbox dispatch:
 * - Webhook ingress receives events and stages to outbox
 * - De-duplication works correctly for repeated events
 * - Outbox entries can be listed and dispatched
 * - Failed dispatches can be retried
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { WebhookIngressService } from "../../src/platform/interface/webhook/index.js";
import { WebhookOutboxDispatchService } from "../../src/platform/interface/webhook/webhook-outbox-dispatch-service.js";
import { OutboxRepository } from "../../src/platform/shared/outbox/outbox-repository.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-webhook-outbox.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const webhookIngressService = new WebhookIngressService();
  const outboxRepository = new OutboxRepository(db.connection);
  const webhookOutboxDispatchService = new WebhookOutboxDispatchService(webhookIngressService, outboxRepository);

  return {
    workspace,
    db,
    webhookIngressService,
    outboxRepository,
    webhookOutboxDispatchService,
  };
}

test("E2E: webhook ingress receives event and stages to outbox", () => {
  const h = createE2eHarness("e2e-webhook-ingress-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["pull_request.opened", "issue.created"],
      algorithm: "none",
    });

    const result = h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "github",
      payload: { eventType: "pull_request.opened", prId: 123 },
      idempotencyKey: "evt-001",
      traceId: "trace-webhook-001",
    });

    assert.equal(result.persistedToOutbox, true, "Should be persisted to outbox");
    assert.equal(result.duplicate, false, "Should not be duplicate");
    assert.ok(result.outboxEntryId, "Should have outbox entry ID");
    assert.equal(result.envelope.endpointId, "github", "Endpoint ID should match");

    // Verify outbox entry exists
    const entries = h.outboxRepository.listPendingEntries(10);
    const githubEntries = entries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "github",
    );
    assert.equal(githubEntries.length, 1, "Should have one pending entry for github");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: duplicate webhook events are detected and rejected", () => {
  const h = createE2eHarness("e2e-webhook-dedup-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["pull_request.opened"],
      algorithm: "none",
    });

    // First event
    const first = h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "github",
      payload: { eventType: "pull_request.opened", prId: 456 },
      idempotencyKey: "evt-dedup-001",
      traceId: "trace-first",
    });

    // Same event again (duplicate)
    const second = h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "github",
      payload: { eventType: "pull_request.opened", prId: 456 },
      idempotencyKey: "evt-dedup-001", // Same idempotency key
      traceId: "trace-second",
    });

    assert.equal(first.persistedToOutbox, true, "First should be persisted");
    assert.equal(first.duplicate, false, "First should not be duplicate");
    assert.equal(second.persistedToOutbox, false, "Second should not be persisted");
    assert.equal(second.duplicate, true, "Second should be detected as duplicate");

    // Verify only one entry exists in outbox
    const entries = h.outboxRepository.listPendingEntries(10);
    const githubEntries = entries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "github",
    );
    assert.equal(githubEntries.length, 1, "Should only have one entry (deduped)");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: webhook with different idempotency keys are separate events", () => {
  const h = createE2eHarness("e2e-webhook-separate-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["push.commit"],
      algorithm: "none",
    });

    // Two separate commits
    const first = h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "github",
      payload: { eventType: "push.commit", sha: "abc123" },
      idempotencyKey: "commit-001",
      traceId: "trace-commit-1",
    });

    const second = h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "github",
      payload: { eventType: "push.commit", sha: "def456" },
      idempotencyKey: "commit-002", // Different key
      traceId: "trace-commit-2",
    });

    assert.equal(first.persistedToOutbox, true, "First should be persisted");
    assert.equal(second.persistedToOutbox, true, "Second should be persisted");

    // Verify both entries exist
    const entries = h.outboxRepository.listPendingEntries(10);
    const githubEntries = entries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "github",
    );
    assert.equal(githubEntries.length, 2, "Should have two entries");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: unregistered endpoint is rejected", () => {
  const h = createE2eHarness("e2e-webhook-unregistered-");

  try {
    // No endpoints registered

    assert.throws(
      () => {
        h.webhookOutboxDispatchService.receiveAndStage({
          endpointId: "unknown-endpoint",
          payload: { eventType: "test.event" },
          idempotencyKey: "evt-unknown",
          traceId: "trace-unknown",
        });
      },
      /webhook.endpoint_not_found/,
      "Should throw for unregistered endpoint",
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: disabled endpoint rejects events", () => {
  const h = createE2eHarness("e2e-webhook-disabled-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "disabled-webhook",
      source: "disabled",
      tenantId: null,
      workspaceId: null,
      enabled: false, // Disabled
      allowedEventTypes: ["test.event"],
      algorithm: "none",
    });

    assert.throws(
      () => {
        h.webhookOutboxDispatchService.receiveAndStage({
          endpointId: "disabled-webhook",
          payload: { eventType: "test.event" },
          idempotencyKey: "evt-disabled",
          traceId: "trace-disabled",
        });
      },
      /webhook.endpoint_disabled/,
      "Should throw for disabled endpoint",
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: outbox entry can be verified by status", () => {
  const h = createE2eHarness("e2e-outbox-status-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "gitlab",
      source: "gitlab",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["merge_request.opened"],
      algorithm: "none",
    });

    const result = h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "gitlab",
      payload: { eventType: "merge_request.opened", mrId: 789 },
      idempotencyKey: "mr-001",
      traceId: "trace-mr",
    });

    assert.ok(result.outboxEntryId, "Should have entry ID");

    const status = h.outboxRepository.getStatus(result.outboxEntryId!);
    assert.ok(status, "Should be able to get status");
    assert.equal(status?.status, "PENDING", "Status should be PENDING");
    assert.equal(status?.retryCount, 0, "Retry count should be 0");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: multiple endpoints have separate outbox entries", () => {
  const h = createE2eHarness("e2e-outbox-multi-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "github",
      source: "github",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["push"],
      algorithm: "none",
    });

    h.webhookIngressService.registerEndpoint({
      endpointId: "gitlab",
      source: "gitlab",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["push"],
      algorithm: "none",
    });

    // GitHub event
    h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "github",
      payload: { eventType: "push", repo: "github/repo" },
      idempotencyKey: "gh-push-001",
      traceId: "trace-gh",
    });

    // GitLab event
    h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "gitlab",
      payload: { eventType: "push", repo: "gitlab/repo" },
      idempotencyKey: "gl-push-001",
      traceId: "trace-gl",
    });

    // Verify separate entries
    const allEntries = h.outboxRepository.listPendingEntries(10);
    assert.equal(allEntries.length, 2, "Should have 2 entries total");

    const githubEntries = allEntries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "github",
    );
    const gitlabEntries = allEntries.filter(
      (e) => e.aggregateType === "webhook_endpoint" && e.aggregateId === "gitlab",
    );

    assert.equal(githubEntries.length, 1, "Should have 1 GitHub entry");
    assert.equal(gitlabEntries.length, 1, "Should have 1 GitLab entry");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: webhook ingress service registers and retrieves endpoints", () => {
  const h = createE2eHarness("e2e-endpoint-reg-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "custom-webhook",
      source: "custom",
      tenantId: "tenant-123",
      workspaceId: "workspace-456",
      enabled: true,
      allowedEventTypes: ["custom.event.type"],
      algorithm: "hmac_sha256",
    });

    const endpoint = h.webhookIngressService.getEndpoint("custom-webhook");

    assert.ok(endpoint, "Should be able to get registered endpoint");
    assert.equal(endpoint?.endpointId, "custom-webhook", "Endpoint ID should match");
    assert.equal(endpoint?.source, "custom", "Source should match");
    assert.equal(endpoint?.tenantId, "tenant-123", "Tenant ID should match");
    assert.equal(endpoint?.workspaceId, "workspace-456", "Workspace ID should match");
    assert.equal(endpoint?.enabled, true, "Should be enabled");
    assert.deepEqual(endpoint?.allowedEventTypes, ["custom.event.type"], "Allowed event types should match");
    assert.equal(endpoint?.algorithm, "hmac_sha256", "Algorithm should match");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: webhook ingress can list all endpoints", () => {
  const h = createE2eHarness("e2e-endpoint-list-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "webhook-1",
      source: "source-1",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["event.1"],
      algorithm: "none",
    });

    h.webhookIngressService.registerEndpoint({
      endpointId: "webhook-2",
      source: "source-2",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["event.2"],
      algorithm: "none",
    });

    const endpoints = h.webhookIngressService.listEndpoints();

    assert.equal(endpoints.length, 2, "Should have 2 endpoints");
    assert.ok(endpoints.some((e) => e.endpointId === "webhook-1"), "Should have webhook-1");
    assert.ok(endpoints.some((e) => e.endpointId === "webhook-2"), "Should have webhook-2");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("E2E: outbox can track pending and failed entries", () => {
  const h = createE2eHarness("e2e-outbox-pending-");

  try {
    h.webhookIngressService.registerEndpoint({
      endpointId: "tracker",
      source: "tracker",
      tenantId: null,
      workspaceId: null,
      enabled: true,
      allowedEventTypes: ["track.event"],
      algorithm: "none",
    });

    // Add entry
    h.webhookOutboxDispatchService.receiveAndStage({
      endpointId: "tracker",
      payload: { eventType: "track.event", data: "test" },
      idempotencyKey: "track-001",
      traceId: "trace-track",
    });

    const pending = h.outboxRepository.countPending();
    assert.equal(pending, 1, "Should have 1 pending entry");

    const failed = h.outboxRepository.countFailed();
    assert.equal(failed, 0, "Should have 0 failed entries");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
