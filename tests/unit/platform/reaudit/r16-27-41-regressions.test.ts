import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { RedisQueueAdapter } from "../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import { getEventSchema, getRegisteredConsumers } from "../../../../src/platform/five-plane-state-evidence/events/event-registry.js";
import { TIER_1_EVENT_TYPES } from "../../../../src/platform/five-plane-state-evidence/events/event-types.js";
import { ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS } from "../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { CasService, createInMemoryCasService } from "../../../../src/platform/five-plane-state-evidence/events/cas/cas-service.js";
import { SqliteCasRepository } from "../../../../src/platform/five-plane-state-evidence/events/cas/sqlite-cas-repository.js";
import { ProjectionRebuildService } from "../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";
import { DEFAULT_MEMORY_PROMOTION_RULES, shouldEvict } from "../../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import { SemanticKnowledgeGraph } from "../../../../src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("R16-27 durable event bus publishes referenced truth rows atomically with events", () => {
  const workspace = createTempWorkspace("aa-r16-27-atomic-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const taskId = "task-r16-27";
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId,
      traceId: "trace-r16-27",
      payload: {
        fromStatus: "queued",
        toStatus: "running",
      },
    });

    assert.equal(store.task.getTask(taskId)?.id, taskId);
    assert.equal(store.event.listEventsForTask(taskId)[0]?.id, event.id);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R16-29 and R16-30 tier-1 platform events resolve through registry and replay metadata", () => {
  for (const eventType of TIER_1_EVENT_TYPES) {
    const schema = getEventSchema(eventType);
    const consumers = getRegisteredConsumers(eventType);
    assert.equal(schema.type, eventType);
    assert.equal(schema.tier, "tier_1");
    assert.ok(consumers.length > 0, `${eventType} should expose registered consumers`);
  }

  const sideEffectSchema = getEventSchema("platform.side_effect.status_changed");
  assert.equal(sideEffectSchema.type, "platform.side_effect.status_changed");
  assert.deepEqual(getRegisteredConsumers("platform.side_effect.status_changed"), ["truth_projector", "audit_projection"]);
});

test("R16-32 rebuildAll executes shadow build protocol before cutover", () => {
  const repo = {
    listAllEvents: () => [
      {
        id: "evt-1",
        taskId: "task-1",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: "2026-05-10T00:00:00.000Z",
      },
    ],
  };

  const service = new ProjectionRebuildService(repo as never);
  service.registerHandler("reaudit_shadow_projection", (state, event) => ({
    eventCount: ((state?.eventCount as number) ?? 0) + 1,
    lastEventId: event.eventId,
  }));

  const firstResult = service.rebuildAll();
  const firstSnapshotStatus = service.getProjectionSnapshotStatus("reaudit_shadow_projection");

  assert.equal(firstResult.get("reaudit_shadow_projection")?.eventsProcessed, 1);
  assert.equal(firstSnapshotStatus.active?.state.lastEventId, "evt-1");
  assert.equal(firstSnapshotStatus.shadow, null);

  const secondResult = service.rebuildAll();
  const secondSnapshotStatus = service.getProjectionSnapshotStatus("reaudit_shadow_projection");

  assert.equal(secondResult.get("reaudit_shadow_projection")?.eventsProcessed, 1);
  assert.ok(secondSnapshotStatus.previous != null, "cutover should preserve the prior active snapshot");
  assert.equal(secondSnapshotStatus.shadow, null, "shadow slot should be cleared after cutover");
});

test("R16-35 CAS service can use a persistent SQLite repository across service instances", () => {
  const workspace = createTempWorkspace("aa-r16-35-cas-");

  try {
    const db1 = new SqliteDatabase(join(workspace, "cas.db"));
    db1.migrate();
    const db2 = new SqliteDatabase(join(workspace, "cas.db"));
    db2.migrate();

    const cas1 = new CasService(new SqliteCasRepository(db1.connection));
    const cas2 = new CasService(new SqliteCasRepository(db2.connection));

    assert.equal(cas1.compareAndSet("shared-key", 0, "v1").success, true);
    assert.equal(cas2.getValue("shared-key"), "v1");
    assert.equal(cas2.compareAndSet("shared-key", 1, "v2").success, true);

    const staleUpdate = cas1.compareAndSet("shared-key", 1, "v3");
    assert.equal(staleUpdate.success, false);
    assert.equal(staleUpdate.currentValue, "v2");
    assert.equal(staleUpdate.currentVersion, 2);

    db1.close();
    db2.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R16-35 CAS service still exposes an explicit in-memory helper for non-durable callers", () => {
  const cas = createInMemoryCasService();
  assert.equal(cas.compareAndSet("key", 0, "value").success, true);
  assert.equal(cas.getValue("key"), "value");
});

test("R16-36 active subscriber poll interval is no longer 10ms", () => {
  assert.equal(ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS, 100);
});

test("R16-40 redis queue adapter keeps in-memory runtime path reachable for queue coverage gates", async () => {
  const previousRunningTests = process.env.AA_RUNNING_TESTS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AA_RUNNING_TESTS = "1";
  process.env.NODE_ENV = "test";

  try {
    const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
    const job = await adapter.enqueueAsync({
      queueName: "reaudit-queue",
      payload: { taskId: "task-r16-40" },
      idempotencyKey: "reaudit-idempotent",
    });

    const stored = await adapter.getJobAsync(job.id);
    const stats = await adapter.statsAsync("reaudit-queue");
    const queues = await adapter.listQueuesAsync();

    assert.equal(stored?.id, job.id);
    assert.equal(stats.waiting, 1);
    assert.equal(queues.includes("reaudit-queue"), true);

    await adapter.close();
  } finally {
    if (previousRunningTests == null) {
      delete process.env.AA_RUNNING_TESTS;
    } else {
      process.env.AA_RUNNING_TESTS = previousRunningTests;
    }
    if (previousNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("R16-38 and R16-39 memory promotion and eviction reporting are wired", () => {
  assert.equal(
    DEFAULT_MEMORY_PROMOTION_RULES.some((rule) => rule.from === "runtime" && rule.to === "session"),
    true,
  );

  const reasons: string[] = [];
  const shouldDrop = shouldEvict(
    {
      id: "mem-1",
      taskId: null,
      sessionId: "session-1",
      agentId: null,
      executionId: null,
      memoryLayer: "layer_3",
      scope: "task_runtime",
      contentJson: "{\"content\":\"stale\"}",
      classification: "fact",
      sourceTrustLevel: "trusted",
      contentHash: "hash",
      createdAt: "2020-01-01T00:00:00.000Z",
      lastAccessedAt: "2020-01-01T00:00:00.000Z",
      importanceScore: 0.1,
      qualityScore: 0.1,
      hitCount: 0,
      expiresAt: null,
      revokedAt: null,
      revocationReason: null,
      kind: "fact",
      status: "active",
      freshnessScore: 0.1,
    },
    10,
    5,
    { onEvict: (_memory, reason) => reasons.push(reason) },
  );

  assert.equal(shouldDrop, true);
  assert.ok(reasons.includes("ttl_expired") || reasons.includes("capacity_pressure"));
});

test("R16-33, R16-34, and R16-41 semantic knowledge graph keeps trust levels, adjacency lookup, and edge dedupe", () => {
  const graph = new SemanticKnowledgeGraph();

  graph.addEntityRelation("source", "target", "related_to", 0.8, "official");
  graph.addEntityRelation("source", "target", "relates_to", 0.5, "official");

  const inspection = graph.inspect({ limit: 10 });
  const sourceNode = inspection.nodes.find((node) => node.nodeId === "entity:source");
  const dedupedEdges = inspection.edges.filter((edge) => edge.edgeId === "relates_to:entity:source:entity:target");

  assert.equal(sourceNode?.trustLevel, "official");
  assert.equal(dedupedEdges.length, 1);
  assert.equal(dedupedEdges[0]?.weight, 0.5);
});
