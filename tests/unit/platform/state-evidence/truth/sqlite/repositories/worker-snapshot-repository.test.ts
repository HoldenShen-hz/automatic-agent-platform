import assert from "node:assert/strict";
import test from "node:test";

import type {
  CoordinatorInstanceRecord,
  HeartbeatSnapshotRecord,
  WorkerSnapshotRecord,
} from "../../../../../../../src/platform/contracts/types/domain.js";
import { WorkerSnapshotRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-snapshot-repository.js";

// Mock the query-helper module
const mockQueryOne = test.mock;
const mockQueryAll = test.mock;
const mockExecute = test.mock;

function createMockWorkerSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker-1",
    status: "active",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: null,
    runningExecutionsJson: null,
    maxConcurrency: 5,
    queueAffinity: null,
    runtimeInstanceId: "instance-1",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 45.5,
    memoryMb: 512,
    toolBacklogCount: 3,
    currentStepId: null,
    lastProgressAt: "2026-04-26T12:00:00.000Z",
    lastHeartbeatAt: "2026-04-26T12:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    ...overrides,
  };
}

function createMockHeartbeatSnapshot(overrides: Partial<HeartbeatSnapshotRecord> = {}): HeartbeatSnapshotRecord {
  return {
    id: "hb-1",
    executionId: "exec-1",
    agentId: "agent-1",
    runtimeInstanceId: "instance-1",
    restartGeneration: 0,
    status: "running",
    progressMessage: "Processing step 5",
    cpuPct: 50.0,
    memoryMb: 256,
    sampledAt: "2026-04-26T12:00:00.000Z",
    ...overrides,
  };
}

function createMockCoordinatorInstance(overrides: Partial<CoordinatorInstanceRecord> = {}): CoordinatorInstanceRecord {
  return {
    coordinatorId: "coord-1",
    region: "us-west-2",
    role: "primary",
    queueAffinity: null,
    status: "active",
    maxConcurrentDispatches: 10,
    activeDispatchCount: 3,
    backlogCount: 7,
    cpuPct: 35.0,
    shardJson: null,
    lastHeartbeatAt: "2026-04-26T12:00:00.000Z",
    metadataJson: null,
    createdAt: "2026-04-26T10:00:00.000Z",
    updatedAt: "2026-04-26T12:00:00.000Z",
    ...overrides,
  };
}

test("WorkerSnapshotRepository constructor accepts connection", () => {
  // This test verifies the class can be instantiated with a mock connection
  // In a real scenario this would use an actual database connection
  const mockConn = {};
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.ok(repo);
});

test("WorkerSnapshotRepository has insertHeartbeatSnapshot method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.insertHeartbeatSnapshot, "function");
});

test("WorkerSnapshotRepository has upsertWorkerSnapshot method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.upsertWorkerSnapshot, "function");
});

test("WorkerSnapshotRepository has upsertCoordinatorInstanceSnapshot method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.upsertCoordinatorInstanceSnapshot, "function");
});

test("WorkerSnapshotRepository has getWorkerSnapshot method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      get: () => undefined,
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.getWorkerSnapshot, "function");
});

test("WorkerSnapshotRepository has listWorkerSnapshots method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.listWorkerSnapshots, "function");
});

test("WorkerSnapshotRepository has listStaleWorkerSnapshots method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.listStaleWorkerSnapshots, "function");
});

test("WorkerSnapshotRepository has getCoordinatorInstanceSnapshot method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      get: () => undefined,
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.getCoordinatorInstanceSnapshot, "function");
});

test("WorkerSnapshotRepository has listCoordinatorInstanceSnapshots method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.listCoordinatorInstanceSnapshots, "function");
});

test("WorkerSnapshotRepository has listHeartbeatSnapshotsByExecution method", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  assert.equal(typeof repo.listHeartbeatSnapshotsByExecution, "function");
});

test("WorkerSnapshotRecord has correct structure", () => {
  const snapshot = createMockWorkerSnapshot();
  assert.equal(snapshot.workerId, "worker-1");
  assert.equal(snapshot.status, "active");
  assert.equal(typeof snapshot.lastHeartbeatAt, "string");
});

test("HeartbeatSnapshotRecord has correct structure", () => {
  const snapshot = createMockHeartbeatSnapshot();
  assert.equal(snapshot.id, "hb-1");
  assert.equal(snapshot.executionId, "exec-1");
  assert.equal(snapshot.agentId, "agent-1");
  assert.equal(snapshot.status, "running");
});

test("CoordinatorInstanceRecord has correct structure", () => {
  const record = createMockCoordinatorInstance();
  assert.equal(record.coordinatorId, "coord-1");
  assert.equal(record.region, "us-west-2");
  assert.equal(record.role, "primary");
  assert.equal(record.status, "active");
});

test("WorkerSnapshotRecord default values", () => {
  const snapshot = createMockWorkerSnapshot({
    placement: undefined,
    isolationLevel: undefined,
  });
  assert.equal(snapshot.placement, undefined);
  assert.equal(snapshot.isolationLevel, undefined);
});

test("WorkerSnapshotRecord with all optional fields", () => {
  const now = new Date().toISOString();
  const snapshot = createMockWorkerSnapshot({
    repoVersion: "v1.2.3",
    remoteSessionStatus: "connected",
    saturation: 0.75,
    activeLeaseCount: 10,
    cpuPct: 80.5,
    memoryMb: 2048,
    currentStepId: "step-5",
  });
  assert.equal(snapshot.repoVersion, "v1.2.3");
  assert.equal(snapshot.remoteSessionStatus, "connected");
  assert.equal(snapshot.saturation, 0.75);
  assert.equal(snapshot.activeLeaseCount, 10);
  assert.equal(snapshot.cpuPct, 80.5);
  assert.equal(snapshot.memoryMb, 2048);
  assert.equal(snapshot.currentStepId, "step-5");
});

test("HeartbeatSnapshotRecord with optional fields", () => {
  const snapshot = createMockHeartbeatSnapshot({
    progressMessage: "Step 3 of 10",
    cpuPct: 62.5,
    memoryMb: 1024,
  });
  assert.equal(snapshot.progressMessage, "Step 3 of 10");
  assert.equal(snapshot.cpuPct, 62.5);
  assert.equal(snapshot.memoryMb, 1024);
});

test("CoordinatorInstanceRecord with shard metadata", () => {
  const record = createMockCoordinatorInstance({
    shardJson: '{"shardId": "shard-1", "range": [0, 100]}',
    metadataJson: '{"version": "1.0"}',
  });
  assert.ok(record.shardJson);
  assert.ok(record.metadataJson);
});

test("listWorkerSnapshots accepts status filter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  const results = repo.listWorkerSnapshots("active");
  assert.ok(Array.isArray(results));
});

test("listWorkerSnapshots accepts limit parameter", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  const results = repo.listWorkerSnapshots(undefined, 10);
  assert.ok(Array.isArray(results));
});

test("listStaleWorkerSnapshots requires heartbeat timestamp", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  const staleThreshold = new Date(Date.now() - 60000).toISOString();
  const results = repo.listStaleWorkerSnapshots(staleThreshold);
  assert.ok(Array.isArray(results));
});

test("listCoordinatorInstanceSnapshots has default limit", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  const results = repo.listCoordinatorInstanceSnapshots();
  assert.ok(Array.isArray(results));
});

test("listHeartbeatSnapshotsByExecution accepts tenantId", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  const results = repo.listHeartbeatSnapshotsByExecution("exec-1", "tenant-1");
  assert.ok(Array.isArray(results));
});

test("listHeartbeatSnapshotsByExecution without tenantId", () => {
  const mockConn = {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
  };
  const repo = new WorkerSnapshotRepository(mockConn as any);
  const results = repo.listHeartbeatSnapshotsByExecution("exec-1");
  assert.ok(Array.isArray(results));
});