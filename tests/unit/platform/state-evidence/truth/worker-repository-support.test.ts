import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import type { AsyncSqlConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { executeWorkerSnapshotUpsert } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository-support.js";
import type { WorkerSnapshotRecord } from "../../../../../src/contracts/types/domain.js";

describe("executeWorkerSnapshotUpsert", () => {
  let mockConnection: AsyncSqlConnection;
  let mockExecute: ReturnType<typeof mock.fn>;

  const baseSnapshot: WorkerSnapshotRecord = {
    workerId: "worker-001",
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
    capabilitiesJson: "{}",
    runningExecutionsJson: "[]",
    maxConcurrency: 10,
    queueAffinity: null,
    runtimeInstanceId: "instance-1",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 45.5,
    memoryMb: 2048,
    toolBacklogCount: 5,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-05-21T12:00:00Z",
    updatedAt: "2026-05-21T12:00:00Z",
    version: 1,
  };

  beforeEach(() => {
    mockExecute = mock.fn(async () => 1);
    mockConnection = {
      execute: mockExecute,
      query: mock.fn(async () => []),
      queryOne: mock.fn(async () => null),
      transaction: mock.fn(async () => {}),
    } as unknown as AsyncSqlConnection;
  });

  it("should execute upsert with ON CONFLICT clause", async () => {
    await executeWorkerSnapshotUpsert(mockConnection, baseSnapshot);

    const call = mockExecute.mock.calls[0];
    const sql = call.arguments[0] as string;

    assert.ok(sql.includes("INSERT INTO worker_snapshots"));
    assert.ok(sql.includes("ON CONFLICT(worker_id) DO UPDATE SET"));
    assert.ok(sql.includes("version = worker_snapshots.version + 1"));
  });

  it("should include all snapshot columns in insert", async () => {
    await executeWorkerSnapshotUpsert(mockConnection, baseSnapshot);

    const call = mockExecute.mock.calls[0];
    const sql = call.arguments[0] as string;

    // Verify key columns are referenced
    assert.ok(sql.includes("worker_id"));
    assert.ok(sql.includes("status"));
    assert.ok(sql.includes("placement"));
    assert.ok(sql.includes("isolation_level"));
    assert.ok(sql.includes("runtime_instance_id"));
    assert.ok(sql.includes("saturation"));
    assert.ok(sql.includes("active_lease_count"));
    assert.ok(sql.includes("cpu_pct"));
    assert.ok(sql.includes("memory_mb"));
    assert.ok(sql.includes("tool_backlog_count"));
  });

  it("should use version as expectedVersion for conflict check", async () => {
    const snapshotWithVersion = { ...baseSnapshot, version: 5 };

    await executeWorkerSnapshotUpsert(mockConnection, snapshotWithVersion);

    const call = mockExecute.mock.calls[0];
    // The where clause should include the expected version
    assert.ok(call.arguments[0].includes("$36 IS NULL OR worker_snapshots.version = $36"));
  });

  it("should throw error when version conflict detected (0 rows affected)", async () => {
    mockExecute = mock.fn(async () => 0);
    mockConnection.execute = mockExecute;

    const snapshotWithVersion = { ...baseSnapshot, version: 5 };

    await assert.rejects(
      () => executeWorkerSnapshotUpsert(mockConnection, snapshotWithVersion),
      (err: Error) => err.message.includes("worker_snapshot.version_conflict"),
    );
  });

  it("should handle null optional fields with defaults", async () => {
    const snapshotWithNulls: WorkerSnapshotRecord = {
      ...baseSnapshot,
      placement: undefined as unknown as string,
      isolationLevel: undefined as unknown as string,
      repoVersion: undefined,
      remoteSessionStatus: undefined,
      version: undefined as unknown as number,
    };

    await executeWorkerSnapshotUpsert(mockConnection, snapshotWithNulls);

    const call = mockExecute.mock.calls[0];
    // placement defaults to "local" when undefined (passed as $4, index 3)
    assert.ok(call.arguments[3] === "local");
    // isolationLevel defaults to "standard" when undefined (passed as $5, index 4)
    assert.ok(call.arguments[4] === "standard");
  });

  it("should pass all 37 parameters to execute", async () => {
    await executeWorkerSnapshotUpsert(mockConnection, baseSnapshot);

    const call = mockExecute.mock.calls[0];
    // Should have 37 parameters (SQL string + worker_id + 34 columns + version check + version insert)
    assert.strictEqual(call.arguments.length, 37);
  });

  it("should set insertedVersion to 1 when version is undefined or 0", async () => {
    const snapshotNoVersion = { ...baseSnapshot, version: 0 };

    await executeWorkerSnapshotUpsert(mockConnection, snapshotNoVersion);

    const call = mockExecute.mock.calls[0];
    // The 36th argument (index 35) should be 1 (insertedVersion)
    assert.strictEqual(call.arguments[35], 1);
  });

  it("should use existing version when version > 0", async () => {
    const snapshotWithVersion = { ...baseSnapshot, version: 3 };

    await executeWorkerSnapshotUpsert(mockConnection, snapshotWithVersion);

    const call = mockExecute.mock.calls[0];
    // The 36th argument (index 35) should be the version
    assert.strictEqual(call.arguments[35], 3);
  });
});