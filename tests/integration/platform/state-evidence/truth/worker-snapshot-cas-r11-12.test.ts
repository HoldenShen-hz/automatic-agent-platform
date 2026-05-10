import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { WorkerSnapshotRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-snapshot-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createSnapshot(version: number) {
  return {
    workerId: "worker-r11-12",
    status: "active" as const,
    placement: "local" as const,
    isolationLevel: "standard" as const,
    repoVersion: "v1",
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: 0.2,
    activeLeaseCount: 1,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: "runtime-r11-12",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 12,
    memoryMb: 128,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    version,
  };
}

test("R11-12: worker snapshot updates enforce optimistic version CAS", () => {
  const workspace = createTempWorkspace("aa-worker-snapshot-r11-12-");
  const dbPath = join(workspace, "worker-snapshots.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();

  try {
    const repo = new WorkerSnapshotRepository(db.connection);
    repo.upsertWorkerSnapshot(createSnapshot(0));

    const inserted = repo.getWorkerSnapshot("worker-r11-12");
    assert.ok(inserted);
    assert.equal(inserted?.version, 1);

    repo.upsertWorkerSnapshot({
      ...inserted!,
      cpuPct: 22,
      updatedAt: "2026-05-10T00:01:00.000Z",
    });

    const updated = repo.getWorkerSnapshot("worker-r11-12");
    assert.ok(updated);
    assert.equal(updated?.version, 2);
    assert.equal(updated?.cpuPct, 22);

    assert.throws(
      () => {
        repo.upsertWorkerSnapshot({
          ...inserted!,
          cpuPct: 33,
          updatedAt: "2026-05-10T00:02:00.000Z",
        });
      },
      /worker_snapshot\.version_conflict:worker-r11-12:1/,
    );

    const afterConflict = repo.getWorkerSnapshot("worker-r11-12");
    assert.equal(afterConflict?.version, 2);
    assert.equal(afterConflict?.cpuPct, 22);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
