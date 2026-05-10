import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { EventProjectionService } from "../../../../src/platform/state-evidence/projections/index.js";
import { AuditTrailService } from "../../../../src/platform/state-evidence/audit/index.js";
import { IncidentCaseService } from "../../../../src/platform/state-evidence/incident/index.js";
import { DeadLetterQueueService } from "../../../../src/platform/state-evidence/dlq/index.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { ArtifactBundleService } from "../../../../src/platform/state-evidence/artifacts/artifact-bundle-service.js";
import { ArtifactPublishLedger } from "../../../../src/platform/state-evidence/artifacts/artifact-publish-ledger.js";
import { ArtifactPublishService } from "../../../../src/platform/state-evidence/artifacts/artifact-publish-service.js";
import { MemoryService } from "../../../../src/platform/state-evidence/memory/memory-service.js";
import { SessionSummaryService } from "../../../../src/platform/state-evidence/memory/session-summary-service.js";
import { EventOpsService } from "../../../../src/platform/state-evidence/events/event-ops-service.js";
import type { ArtifactRecordExtended } from "../../../../src/platform/five-plane-state-evidence/artifacts/artifact-model.js";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("integration: state-evidence projection, audit, incident, and DLQ share consistent evidence chain", () => {
  const projections = new EventProjectionService();
  const audits = new AuditTrailService();
  const incidents = new IncidentCaseService();
  const dlq = new DeadLetterQueueService();

  const projection = projections.applyEvent({
    eventId: "evt_se_1",
    eventType: "workflow:step_failed",
    taskId: "task_se_42",
    payloadJson: JSON.stringify({ reasonCode: "tool.execution_failed" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  const deadLetter = dlq.enqueue({
    sourceEventId: "evt_se_1",
    consumerId: "channel-gateway",
    errorCode: "delivery.timeout",
    payloadJson: JSON.stringify(projection.state),
  });
  const audit = audits.record({
    actorType: "recovery",
    actorId: "dlq-replayer",
    tenantId: "tenant_se",
    taskId: "task_se_42",
    executionId: null,
    action: "dlq.enqueued",
    resourceRef: `dlq:${deadLetter.deadLetterId}`,
    decisionRef: null,
    versionRef: null,
    metadata: { sourceEventId: deadLetter.sourceEventId },
  });
  const incident = incidents.openIncident({
    severity: "high",
    title: "workflow failure propagated to DLQ",
    linkedEvidenceRefs: [projection.projectionId, audit.auditId, deadLetter.deadLetterId],
  });

  assert.equal(projection.projectionName, "workflow_summary");
  assert.equal(audits.exportForTask("task_se_42").length, 1);
  assert.equal(incident.linkedEvidenceRefs.length, 3);
});

test("integration: state-evidence artifact bundle builds and publishes artifacts", () => {
  const workspace = createTempWorkspace("aa-se-artifact-");
  const dbPath = join(workspace, "se-artifact.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const bundles = new ArtifactBundleService();
    const ledger = new ArtifactPublishLedger({ ledgerPath: join(workspace, "ledger.json") });
    const publishService = new ArtifactPublishService(ledger);

    const bundle = bundles.build({
      taskId: "task-artifact-001",
      domainId: "general_ops",
      bundleType: "asset_bundle",
      artifacts: [
        {
          artifactId: newId("artifact"),
          harnessRunId: "harness-artifact-001",
          nodeRunId: undefined,
          taskId: "task-artifact-001",
          executionId: "exec-artifact-001",
          type: "source_code",
          path: "test.ts",
          mimeType: "text/typescript",
          sizeBytes: 1024,
          checksum: "hash_artifact_001",
          version: 1,
          createdAt: nowIso(),
        } as unknown as ArtifactRecordExtended,
      ],
    });

    const published = publishService.publish(bundle);

    assert.ok(published.bundleId.startsWith("artifact_bundle"));
    assert.equal(published.artifacts.length, 1);
    assert.equal(published.publishStatus, "published");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: state-evidence memory service records and retrieves memories", () => {
  const ctx = createIntegrationContext("aa-se-memory-");

  try {
    const memory = new MemoryService(ctx.store);
    const summary = new SessionSummaryService(ctx.store);

    memory.remember({
      scope: "test",
      content: "test memory content",
    });

    const entries = memory.recall({
      scopes: ["test"],
    });

    assert.ok(entries.length > 0);

    summary.createSummary({
      sessionId: "sess-memory-001",
      summaryText: "Test session summary",
    });
  } finally {
    ctx.cleanup();
  }
});

test("integration: state-evidence event ops service drains events for a consumer", async () => {
  const workspace = createTempWorkspace("aa-se-event-ops-");
  const dbPath = join(workspace, "se-event-ops.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventOps = new EventOpsService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-event-ops-001",
      executionId: "exec-event-ops-001",
      traceId: "trace-event-ops-001",
    });

    store.insertEvent({
      id: "evt-event-ops-001",
      taskId: "task-event-ops-001",
      executionId: "exec-event-ops-001",
      traceId: "trace-event-ops-001",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ newStatus: "in_progress" }),
      createdAt: "2026-04-20T10:00:00.000Z",
    });

    const drainResult = await eventOps.drainConsumer("test-consumer");

    assert.ok(typeof drainResult.pendingBefore === "number");
    assert.ok(typeof drainResult.delivered === "number");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: state-evidence task store persists and queries tasks with events", () => {
  const ctx = createIntegrationContext("aa-se-task-store-");

  try {
    const { db, store } = ctx;

    seedTaskAndExecution(db, store, {
      taskId: "task-se-001",
      executionId: "exec-se-001",
      traceId: "trace-se-001",
    });

    store.insertEvent({
      id: "evt-se-001",
      taskId: "task-se-001",
      executionId: "exec-se-001",
      traceId: "trace-se-001",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ newStatus: "in_progress" }),
      createdAt: "2026-04-20T10:00:00.000Z",
    });

    const task = ctx.store.getTask("task-se-001");
    const events = ctx.store.listEventsForTask("task-se-001");

    assert.ok(task != null);
    assert.equal(task.id, "task-se-001");
    assert.ok(events.length > 0);
    assert.equal(events[0]?.eventType, "task:status_changed");
  } finally {
    ctx.cleanup();
  }
});

test("integration: state-evidence workflow state stores and retrieves checkpoints", () => {
  const ctx = createIntegrationContext("aa-se-checkpoint-");

  try {
    const { db, store } = ctx;

    seedTaskAndExecution(db, store, {
      taskId: "task-checkpoint-001",
      executionId: "exec-checkpoint-001",
      traceId: "trace-checkpoint-001",
    });

    store.insertWorkflowState({
      taskId: "task-checkpoint-001",
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 2,
      status: "running",
      outputsJson: JSON.stringify({ step: "completed" }),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: "2026-04-20T09:00:00.000Z",
      updatedAt: "2026-04-20T09:30:00.000Z",
    });

    const workflow = store.getWorkflowState("task-checkpoint-001");

    assert.ok(workflow != null);
    assert.equal(workflow.currentStepIndex, 2);
    assert.equal(workflow.status, "running");
  } finally {
    ctx.cleanup();
  }
});

test("integration: state-evidence audit trail records and exports audit entries", () => {
  const audits = new AuditTrailService();

  const entry = audits.record({
    actorType: "agent",
    actorId: "agent-001",
    tenantId: "tenant-audit",
    taskId: "task-audit-001",
    executionId: "exec-audit-001",
    action: "task.complete",
    resourceRef: "task:task-audit-001",
    decisionRef: null,
    versionRef: null,
    metadata: { reason: "test audit" },
  });

  assert.ok(entry.auditId != null);

  const exported = audits.exportForTask("task-audit-001");
  assert.equal(exported.length, 1);
  assert.equal(exported[0]?.action, "task.complete");
});

test("integration: state-evidence incident case service records and retrieves incidents", () => {
  const incidents = new IncidentCaseService();

  const incident = incidents.openIncident({
    severity: "medium",
    title: "Test incident",
    linkedEvidenceRefs: ["ref-1", "ref-2"],
  });

  assert.ok(incident.incidentId != null);
  assert.equal(incident.severity, "medium");
  assert.equal(incident.linkedEvidenceRefs.length, 2);

  const retrieved = incidents.getIncident(incident.incidentId);
  assert.ok(retrieved != null);
  assert.equal(retrieved.title, "Test incident");
});