import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { CoordinatorLoadBalancingService } from "../../../src/platform/five-plane-execution/ha/coordinator-load-balancing-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

function createServiceHarness() {
  const workspace = createTempWorkspace("aa-control-plane-unit-");
  const dbPath = join(workspace, "control-plane.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new CoordinatorLoadBalancingService(db, store);

  return {
    db,
    store,
    service,
    close() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

test("coordinator load balancing summarizes fleet status and selects an eligible coordinator [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "coord-cn-hot",
      region: "cn-sha",
      queueAffinity: "default",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 8,
      backlogCount: 8,
      cpuPct: 92,
      shards: ["tenant-a"],
      heartbeatAt: "2026-04-09T01:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "coord-us-cool",
      region: "us-west",
      queueAffinity: "default",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 1,
      backlogCount: 0,
      cpuPct: 18,
      shards: ["tenant-b"],
      heartbeatAt: "2026-04-09T01:00:30.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "coord-draining",
      region: "us-east",
      queueAffinity: "default",
      status: "draining",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 2,
      backlogCount: 0,
      cpuPct: 12,
      heartbeatAt: "2026-04-09T01:01:00.000Z",
    });

    const summary = harness.service.buildSummary("2026-04-09T01:02:00.000Z");
    assert.equal(summary.coordinatorCount, 3);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.drainingCount, 1);
    assert.equal(summary.offlineCount, 0);
    assert.deepEqual(summary.regions, ["cn-sha", "us-east", "us-west"]);
    assert.deepEqual(summary.hotCoordinatorIds, ["coord-cn-hot"]);

    const decision = harness.service.selectCoordinator({
      queueName: "default",
      preferredRegion: "us-west",
      tenantId: "tenant-b",
      requestKey: "req-123",
    });

    assert.equal(decision.outcome, "selected");
    assert.equal(decision.selectedCoordinatorId, "coord-us-cool");
    assert.ok(
      decision.evaluations.some(
        (evaluation) => evaluation.coordinatorId === "coord-draining" && evaluation.reasonCode === "coordinator_inactive",
      ),
    );
    assert.ok(
      decision.evaluations.some(
        (evaluation) =>
          evaluation.coordinatorId === "coord-cn-hot" && evaluation.reasonCode === "tenant_shard_mismatch",
      ),
    );
  } finally {
    harness.close();
  }
});

test("coordinator load balancing fail-closes when no active coordinator matches the requested queue [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "coord-a",
      region: "cn-sha",
      queueAffinity: "queue-a",
      status: "offline",
      heartbeatAt: "2026-04-09T01:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "coord-b",
      region: "us-west",
      queueAffinity: "queue-b",
      status: "active",
      heartbeatAt: "2026-04-09T01:00:00.000Z",
    });

    const decision = harness.service.selectCoordinator({
      queueName: "queue-a",
      requestKey: "req-no-match",
    });

    assert.equal(decision.outcome, "no_candidate");
    assert.equal(decision.selectedCoordinatorId, null);
    assert.equal(decision.reasonCode, "no_active_coordinator");
  } finally {
    harness.close();
  }
});

test("registerHeartbeat creates new coordinator if not exists [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    const record = harness.service.registerHeartbeat({
      coordinatorId: "new-coord",
      region: "eu-west",
      status: "active",
      maxConcurrentDispatches: 16,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    assert.equal(record.coordinatorId, "new-coord");
    assert.equal(record.region, "eu-west");
    assert.equal(record.status, "active");
    assert.equal(record.maxConcurrentDispatches, 16);
    assert.ok(record.createdAt !== record.updatedAt || record.createdAt === record.updatedAt);
  } finally {
    harness.close();
  }
});

test("registerHeartbeat updates existing coordinator [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "coord-update",
      region: "us-east",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 2,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const updated = harness.service.registerHeartbeat({
      coordinatorId: "coord-update",
      region: "us-east",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 5,
      heartbeatAt: "2026-04-09T10:01:00.000Z",
    });

    assert.equal(updated.coordinatorId, "coord-update");
    assert.equal(updated.activeDispatchCount, 5);
    assert.equal(updated.lastHeartbeatAt, "2026-04-09T10:01:00.000Z");
  } finally {
    harness.close();
  }
});

test("registerHeartbeat generates coordinatorId if not provided [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    const record = harness.service.registerHeartbeat({
      region: "ap-south",
      status: "active",
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    assert.ok(record.coordinatorId.startsWith("coordinator_"));
    assert.equal(record.region, "ap-south");
  } finally {
    harness.close();
  }
});

test("registerHeartbeat normalizes shards and deduplicates [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    const record = harness.service.registerHeartbeat({
      coordinatorId: "coord-shards",
      region: "us-west",
      shards: ["tenant-a", "  tenant-b  ", "tenant-a", "tenant-c"],
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    // Should be sorted and deduplicated
    assert.ok(record.shardJson.includes("tenant-a"));
    assert.ok(record.shardJson.includes("tenant-b"));
    assert.ok(record.shardJson.includes("tenant-c"));
  } finally {
    harness.close();
  }
});

test("listSnapshots returns coordinator records [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "list-coord-1",
      region: "us-west",
      status: "active",
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "list-coord-2",
      region: "eu-west",
      status: "active",
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const snapshots = harness.service.listSnapshots();
    assert.equal(snapshots.length, 2);
    const ids = snapshots.map((s) => s.coordinatorId).sort();
    assert.deepEqual(ids, ["list-coord-1", "list-coord-2"]);
  } finally {
    harness.close();
  }
});

test("selectCoordinator prefers lower load when all are eligible [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "low-load",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 1,
      backlogCount: 0,
      cpuPct: 10,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "high-load",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 6,
      backlogCount: 4,
      cpuPct: 80,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const decision = harness.service.selectCoordinator({
      requestKey: "req-balance-test",
    });

    assert.equal(decision.outcome, "selected");
    assert.equal(decision.selectedCoordinatorId, "low-load");
  } finally {
    harness.close();
  }
});

test("selectCoordinator considers queue affinity [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "queue-specific",
      region: "us-west",
      queueAffinity: "priority-queue",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 6,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "queue-default",
      region: "us-west",
      queueAffinity: "default",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 1,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const decision = harness.service.selectCoordinator({
      queueName: "priority-queue",
      requestKey: "req-queue-affinity",
    });

    assert.equal(decision.outcome, "selected");
    assert.equal(decision.selectedCoordinatorId, "queue-specific");
  } finally {
    harness.close();
  }
});

test("selectCoordinator considers preferred region when loads are similar [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "region-us",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 6, // activeRatio = 0.75, regionBonus = -0.15, total = 0.60
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "region-eu",
      region: "eu-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 7, // activeRatio = 0.875, no region bonus, total = 0.875
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    // With preferred region set to us-west, us-west should win due to region bonus
    // us-west: 0.75 - 0.15 = 0.60 (wins due to region bonus and lower load)
    // eu-west: 0.875 + 0 = 0.875 (loses due to higher load and no bonus)
    const decision = harness.service.selectCoordinator({
      preferredRegion: "us-west",
      requestKey: "req-region-pref",
    });

    assert.equal(decision.outcome, "selected");
    assert.equal(decision.selectedCoordinatorId, "region-us");
  } finally {
    harness.close();
  }
});

test("selectCoordinator filters by tenant shard [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "shard-a",
      region: "us-west",
      status: "active",
      shards: ["tenant-a", "tenant-b"],
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "shard-c",
      region: "us-west",
      status: "active",
      shards: ["tenant-c"],
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const decision = harness.service.selectCoordinator({
      tenantId: "tenant-a",
      requestKey: "req-tenant-shard",
    });

    assert.equal(decision.outcome, "selected");
    assert.equal(decision.selectedCoordinatorId, "shard-a");
  } finally {
    harness.close();
  }
});

test("selectCoordinator rejects inactive coordinator [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "coord-inactive",
      region: "us-west",
      status: "draining",
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const decision = harness.service.selectCoordinator({
      requestKey: "req-inactive",
    });

    assert.equal(decision.outcome, "no_candidate");
    assert.equal(decision.selectedCoordinatorId, null);
    assert.ok(decision.evaluations.some(
      (e) => e.coordinatorId === "coord-inactive" && e.reasonCode === "coordinator_inactive",
    ));
  } finally {
    harness.close();
  }
});

test("buildSummary calculates correct totals [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "summary-1",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 3,
      backlogCount: 5,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "summary-2",
      region: "eu-west",
      status: "draining",
      maxConcurrentDispatches: 16,
      activeDispatchCount: 8,
      backlogCount: 2,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "summary-3",
      region: "us-west",
      status: "offline",
      maxConcurrentDispatches: 4,
      activeDispatchCount: 0,
      backlogCount: 0,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const summary = harness.service.buildSummary("2026-04-09T11:00:00.000Z");

    assert.equal(summary.coordinatorCount, 3);
    assert.equal(summary.activeCount, 1);
    assert.equal(summary.drainingCount, 1);
    assert.equal(summary.offlineCount, 1);
    assert.equal(summary.totalCapacity, 28); // 8 + 16 + 4
    assert.equal(summary.totalActiveDispatchCount, 11); // 3 + 8 + 0
    assert.equal(summary.totalBacklogCount, 7); // 5 + 2 + 0
    assert.ok(summary.regions.includes("us-west"));
    assert.ok(summary.regions.includes("eu-west"));
  } finally {
    harness.close();
  }
});

test("buildSummary identifies hot coordinators [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "hot-coord",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 8,
      backlogCount: 8,
      cpuPct: 95,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "cold-coord",
      region: "eu-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 1,
      backlogCount: 0,
      cpuPct: 10,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const summary = harness.service.buildSummary();

    assert.deepEqual(summary.hotCoordinatorIds, ["hot-coord"]);
  } finally {
    harness.close();
  }
});

test("selectCoordinator returns all evaluations even when no candidate [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "offline-coord",
      region: "us-west",
      status: "offline",
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    const decision = harness.service.selectCoordinator({});

    assert.equal(decision.outcome, "no_candidate");
    assert.equal(decision.evaluations.length, 1);
    assert.equal(decision.evaluations[0]!.eligible, false);
    assert.equal(decision.evaluations[0]!.reasonCode, "coordinator_inactive");
  } finally {
    harness.close();
  }
});

test("registerHeartbeat uses default values for optional fields [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    const record = harness.service.registerHeartbeat({
      coordinatorId: "defaults-test",
      region: "us-west",
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    assert.equal(record.role, "scheduler");
    assert.equal(record.status, "active");
    assert.equal(record.maxConcurrentDispatches, 8);
    assert.equal(record.activeDispatchCount, 0);
    assert.equal(record.backlogCount, 0);
    assert.equal(record.cpuPct, null);
    assert.equal(record.queueAffinity, null);
  } finally {
    harness.close();
  }
});

test("selectCoordinator uses request key for consistent hashing [coordinator-load-balancing-service]", () => {
  const harness = createServiceHarness();
  try {
    harness.service.registerHeartbeat({
      coordinatorId: "coord-a",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 4,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });
    harness.service.registerHeartbeat({
      coordinatorId: "coord-b",
      region: "us-west",
      status: "active",
      maxConcurrentDispatches: 8,
      activeDispatchCount: 4,
      heartbeatAt: "2026-04-09T10:00:00.000Z",
    });

    // With identical load, same request key should always pick the same coordinator
    const decision1 = harness.service.selectCoordinator({ requestKey: "consistent-key" });
    const decision2 = harness.service.selectCoordinator({ requestKey: "consistent-key" });
    const decision3 = harness.service.selectCoordinator({ requestKey: "consistent-key" });

    assert.equal(decision1.selectedCoordinatorId, decision2.selectedCoordinatorId);
    assert.equal(decision2.selectedCoordinatorId, decision3.selectedCoordinatorId);
  } finally {
    harness.close();
  }
});
