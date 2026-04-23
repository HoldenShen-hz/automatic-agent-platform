import assert from "node:assert/strict";
import test from "node:test";

import {
  CoordinatorLoadBalancingService,
  type RegisterCoordinatorHeartbeatInput,
  type CoordinatorSelectionInput,
} from "../../../../../src/platform/execution/ha/coordinator-load-balancing-service.js";
import type { CoordinatorInstanceRecord, CoordinatorInstanceStatus } from "../../../../../src/platform/contracts/types/domain.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock AuthoritativeTaskStore
// ─────────────────────────────────────────────────────────────────────────────

interface MockCoordinatorSnapshot extends CoordinatorInstanceRecord {
  coordinatorId: string;
  region: string;
  role: string;
  queueAffinity: string | null;
  status: CoordinatorInstanceStatus;
  maxConcurrentDispatches: number;
  activeDispatchCount: number;
  backlogCount: number;
  cpuPct: number | null;
  shardJson: string;
  lastHeartbeatAt: string;
  metadataJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockWorkerStore {
  snapshots: Map<string, MockCoordinatorSnapshot>;
  upsertCoordinatorInstanceSnapshot(record: CoordinatorInstanceRecord): void;
  getCoordinatorInstanceSnapshot(coordinatorId: string): CoordinatorInstanceRecord | null;
  listCoordinatorInstanceSnapshots(limit?: number): CoordinatorInstanceRecord[];
}

function createMockWorkerStore(): MockWorkerStore {
  const snapshots = new Map<string, MockCoordinatorSnapshot>();

  return {
    snapshots,

    upsertCoordinatorInstanceSnapshot(record: CoordinatorInstanceRecord) {
      const existing = snapshots.get(record.coordinatorId);
      snapshots.set(record.coordinatorId, {
        ...record,
        shardJson: record.shardJson,
        metadataJson: record.metadataJson,
        createdAt: existing?.createdAt ?? record.createdAt,
        updatedAt: record.updatedAt,
      } as MockCoordinatorSnapshot);
    },

    getCoordinatorInstanceSnapshot(coordinatorId: string) {
      return snapshots.get(coordinatorId) ?? null;
    },

    listCoordinatorInstanceSnapshots(_limit = 100) {
      return Array.from(snapshots.values());
    },
  };
}

interface MockTaskStore {
  worker: MockWorkerStore;
}

function createMockTaskStore(): MockTaskStore {
  return {
    worker: createMockWorkerStore(),
  };
}

interface MockDb {
  transaction<T>(fn: () => T): T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────────────────────

function createService(): {
  service: CoordinatorLoadBalancingService;
  store: MockTaskStore;
} {
  const store = createMockTaskStore();
  const db: MockDb = {
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };

  const service = new CoordinatorLoadBalancingService(db as any, store as any);

  return { service, store };
}

function createCoordinatorRecord(overrides: Partial<CoordinatorInstanceRecord> = {}): CoordinatorInstanceRecord {
  return {
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    role: "scheduler",
    queueAffinity: null,
    status: "active",
    maxConcurrentDispatches: 8,
    activeDispatchCount: 2,
    backlogCount: 5,
    cpuPct: null,
    shardJson: "[]",
    lastHeartbeatAt: new Date().toISOString(),
    metadataJson: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Heartbeat Registration
// ─────────────────────────────────────────────────────────────────────────────

test("CoordinatorLoadBalancingService - registerHeartbeat creates new coordinator", () => {
  const { service, store } = createService();

  const input: RegisterCoordinatorHeartbeatInput = {
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
  };

  const record = service.registerHeartbeat(input);

  assert.equal(record.coordinatorId, "coordinator-1");
  assert.equal(record.region, "us-east-1");
  assert.equal(record.status, "active");
  assert.equal(record.maxConcurrentDispatches, 8); // default
  assert.ok(store.worker.snapshots.has("coordinator-1"));
});

test("CoordinatorLoadBalancingService - registerHeartbeat updates existing coordinator", () => {
  const { service, store } = createService();

  // First registration
  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
  });

  // Second registration with updated values
  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "draining",
    activeDispatchCount: 5,
    backlogCount: 10,
  });

  assert.equal(record.status, "draining");
  assert.equal(record.activeDispatchCount, 5);
  assert.equal(record.backlogCount, 10);
});

test("CoordinatorLoadBalancingService - registerHeartbeat generates ID if not provided", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    region: "us-east-1",
    status: "active",
  });

  assert.ok(record.coordinatorId.includes("coordinator"));
});

test("CoordinatorLoadBalancingService - registerHeartbeat applies defaults", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
  });

  assert.equal(record.role, "scheduler"); // default
  assert.ok(record.maxConcurrentDispatches >= 1);
  assert.equal(record.activeDispatchCount, 0);
  assert.equal(record.backlogCount, 0);
});

test("CoordinatorLoadBalancingService - registerHeartbeat normalizes shards", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    shards: ["shard-1", "shard-2", "shard-1"], // duplicate
  });

  // Shards should be deduplicated and sorted
  const shards = JSON.parse(record.shardJson) as string[];
  assert.equal(shards.length, 2);
  assert.ok(shards.includes("shard-1"));
  assert.ok(shards.includes("shard-2"));
});

test("CoordinatorLoadBalancingService - registerHeartbeat respects queue affinity", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    queueAffinity: "high-priority-queue",
  });

  assert.equal(record.queueAffinity, "high-priority-queue");
});

test("CoordinatorLoadBalancingService - registerHeartbeat clamps cpuPct", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    cpuPct: 150, // over 100
  });

  assert.equal(record.cpuPct, 100);
});

test("CoordinatorLoadBalancingService - registerHeartbeat handles null cpuPct", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    cpuPct: null,
  });

  assert.equal(record.cpuPct, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Snapshot Listing
// ─────────────────────────────────────────────────────────────────────────────

test("CoordinatorLoadBalancingService - listSnapshots returns all snapshots", () => {
  const { service } = createService();

  service.registerHeartbeat({ coordinatorId: "coordinator-1", region: "us-east-1" });
  service.registerHeartbeat({ coordinatorId: "coordinator-2", region: "us-west-1" });

  const snapshots = service.listSnapshots();

  assert.equal(snapshots.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Summary Building
// ─────────────────────────────────────────────────────────────────────────────

test("CoordinatorLoadBalancingService - buildSummary returns correct counts", () => {
  const { service } = createService();

  service.registerHeartbeat({ coordinatorId: "coordinator-1", region: "us-east-1", status: "active" });
  service.registerHeartbeat({ coordinatorId: "coordinator-2", region: "us-east-1", status: "active" });
  service.registerHeartbeat({ coordinatorId: "coordinator-3", region: "us-west-1", status: "draining" });
  service.registerHeartbeat({ coordinatorId: "coordinator-4", region: "us-west-1", status: "offline" });

  const summary = service.buildSummary();

  assert.equal(summary.coordinatorCount, 4);
  assert.equal(summary.activeCount, 2);
  assert.equal(summary.drainingCount, 1);
  assert.equal(summary.offlineCount, 1);
  assert.ok(summary.regions.includes("us-east-1"));
  assert.ok(summary.regions.includes("us-west-1"));
});

test("CoordinatorLoadBalancingService - buildSummary calculates total capacity", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    maxConcurrentDispatches: 10,
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    maxConcurrentDispatches: 5,
  });

  const summary = service.buildSummary();

  assert.equal(summary.totalCapacity, 15);
});

test("CoordinatorLoadBalancingService - buildSummary calculates total load", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    activeDispatchCount: 5,
    backlogCount: 3,
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    activeDispatchCount: 2,
    backlogCount: 7,
  });

  const summary = service.buildSummary();

  assert.equal(summary.totalActiveDispatchCount, 7);
  assert.equal(summary.totalBacklogCount, 10);
});

test("CoordinatorLoadBalancingService - buildSummary identifies hot coordinators", () => {
  const { service } = createService();

  // Normal coordinator (load score < 1.0)
  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 5, // 0.5 ratio
    backlogCount: 0,
  });

  // Hot coordinator (load score >= 1.0)
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    maxConcurrentDispatches: 5,
    activeDispatchCount: 5, // 1.0 ratio + backlog penalty
    backlogCount: 3, // penalty = min(3/5, 4) * 0.2 = 0.12
  });

  const summary = service.buildSummary();

  assert.ok(summary.hotCoordinatorIds.includes("coordinator-2"));
});

test("CoordinatorLoadBalancingService - buildSummary includes generatedAt", () => {
  const { service } = createService();

  const summary = service.buildSummary();

  assert.ok(summary.generatedAt !== undefined);
  assert.ok(new Date(summary.generatedAt).getTime() > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Coordinator Selection
// ─────────────────────────────────────────────────────────────────────────────

test("CoordinatorLoadBalancingService - selectCoordinator returns no_candidate when empty", () => {
  const { service } = createService();

  const decision = service.selectCoordinator({});

  assert.equal(decision.outcome, "no_candidate");
  assert.equal(decision.selectedCoordinatorId, null);
  assert.equal(decision.reasonCode, "no_active_coordinator");
});

test("CoordinatorLoadBalancingService - selectCoordinator selects active coordinator", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 2,
    backlogCount: 0,
  });

  const decision = service.selectCoordinator({});

  assert.equal(decision.outcome, "selected");
  assert.equal(decision.selectedCoordinatorId, "coordinator-1");
});

test("CoordinatorLoadBalancingService - selectCoordinator filters inactive", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "offline",
  });

  const decision = service.selectCoordinator({});

  assert.equal(decision.outcome, "no_candidate");
});

test("CoordinatorLoadBalancingService - selectCoordinator filters by queue affinity", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    queueAffinity: "queue-a",
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    status: "active",
    queueAffinity: "queue-b",
  });

  const decision = service.selectCoordinator({ queueName: "queue-a" });

  assert.equal(decision.outcome, "selected");
  assert.equal(decision.selectedCoordinatorId, "coordinator-1");
});

test("CoordinatorLoadBalancingService - selectCoordinator filters by tenant shard", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    shards: ["tenant-1", "tenant-2"],
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    status: "active",
    shards: ["tenant-3"],
  });

  const decision = service.selectCoordinator({ tenantId: "tenant-1" });

  assert.equal(decision.outcome, "selected");
  assert.equal(decision.selectedCoordinatorId, "coordinator-1");
});

test("CoordinatorLoadBalancingService - selectCoordinator prefers lower load", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 8, // High load
    backlogCount: 0,
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 2, // Low load
    backlogCount: 0,
  });

  const decision = service.selectCoordinator({});

  assert.equal(decision.selectedCoordinatorId, "coordinator-2");
});

test("CoordinatorLoadBalancingService - selectCoordinator gives region bonus", () => {
  const { service } = createService();

  // Two coordinators with same load
  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 5,
    backlogCount: 0,
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-west-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 5,
    backlogCount: 0,
  });

  // Prefer us-east-1
  const decision = service.selectCoordinator({ preferredRegion: "us-east-1" });

  assert.equal(decision.selectedCoordinatorId, "coordinator-1");
});

test("CoordinatorLoadBalancingService - selectCoordinator returns all evaluations", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    status: "offline",
  });

  const decision = service.selectCoordinator({});

  assert.equal(decision.evaluations.length, 2);
  const activeEval = decision.evaluations.find((e) => e.coordinatorId === "coordinator-1");
  const offlineEval = decision.evaluations.find((e) => e.coordinatorId === "coordinator-2");
  assert.equal(activeEval?.eligible, true);
  assert.equal(offlineEval?.eligible, false);
  assert.equal(offlineEval?.reasonCode, "coordinator_inactive");
});

test("CoordinatorLoadBalancingService - selectCoordinator uses requestKey for stable distribution", () => {
  const { service } = createService();

  // Two coordinators with identical load
  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 5,
    backlogCount: 0,
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 5,
    backlogCount: 0,
  });

  // Same request should select same coordinator
  const decision1 = service.selectCoordinator({ requestKey: "same-request" });
  const decision2 = service.selectCoordinator({ requestKey: "same-request" });

  assert.equal(decision1.selectedCoordinatorId, decision2.selectedCoordinatorId);
});

test("CoordinatorLoadBalancingService - selectCoordinator gives queue affinity bonus", () => {
  const { service } = createService();

  // Coordinator with matching queue affinity should win even with slightly higher load
  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 3,
    backlogCount: 0,
    queueAffinity: null, // No affinity
  });
  service.registerHeartbeat({
    coordinatorId: "coordinator-2",
    region: "us-east-1",
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 4, // Slightly higher load
    backlogCount: 0,
    queueAffinity: "test-queue", // Matches!
  });

  const decision = service.selectCoordinator({ queueName: "test-queue" });

  assert.equal(decision.selectedCoordinatorId, "coordinator-2");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("CoordinatorLoadBalancingService - selectCoordinator handles all coordinators ineligible", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "draining",
    queueAffinity: "other-queue",
  });

  const decision = service.selectCoordinator({ queueName: "different-queue" });

  assert.equal(decision.outcome, "no_candidate");
});

test("CoordinatorLoadBalancingService - selectCoordinator handles tenant shard mismatch", () => {
  const { service } = createService();

  service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    status: "active",
    shards: ["tenant-a"],
  });

  const decision = service.selectCoordinator({ tenantId: "tenant-b" });

  assert.equal(decision.outcome, "no_candidate");
});

test("CoordinatorLoadBalancingService - buildSummary handles empty state", () => {
  const { service } = createService();

  const summary = service.buildSummary();

  assert.equal(summary.coordinatorCount, 0);
  assert.equal(summary.activeCount, 0);
  assert.equal(summary.totalCapacity, 0);
  assert.deepEqual(summary.hotCoordinatorIds, []);
});

test("CoordinatorLoadBalancingService - registerHeartbeat with metadata stores it", () => {
  const { service } = createService();

  const record = service.registerHeartbeat({
    coordinatorId: "coordinator-1",
    region: "us-east-1",
    metadata: { customField: "value", count: 42 },
  });

  const parsed = JSON.parse(record.metadataJson!);
  assert.equal(parsed.customField, "value");
  assert.equal(parsed.count, 42);
});
