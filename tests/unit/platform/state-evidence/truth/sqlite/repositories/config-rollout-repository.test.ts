import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  ConfigVersionSnapshotRepository,
  ConfigRollbackPointRepository,
  ConfigRolloutRepository,
  SqliteConfigRolloutStore,
  SqliteConfigVersionStore,
} from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/config-rollout-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";

test("ConfigVersionSnapshotRepository can be instantiated with mock connection", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ConfigVersionSnapshotRepository(mockConn);
  assert.ok(repo);
  assert.equal(typeof repo.insert, "function");
  assert.equal(typeof repo.getByVersionId, "function");
  assert.equal(typeof repo.getByConfigPath, "function");
  assert.equal(typeof repo.deleteOlderThan, "function");
  assert.equal(typeof repo.deleteExcessByPath, "function");
});

test("ConfigRollbackPointRepository can be instantiated with mock connection", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ConfigRollbackPointRepository(mockConn);
  assert.ok(repo);
  assert.equal(typeof repo.insert, "function");
  assert.equal(typeof repo.getByConfigPath, "function");
});

test("ConfigRolloutRepository can be instantiated with mock connection", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ConfigRolloutRepository(mockConn);
  assert.ok(repo);
  assert.equal(typeof repo.save, "function");
  assert.equal(typeof repo.load, "function");
  assert.equal(typeof repo.loadAllActive, "function");
  assert.equal(typeof repo.loadAll, "function");
  assert.equal(typeof repo.delete, "function");
});

test("ConfigVersionSnapshotRepository insert and getByVersionId round-trip", () => {
  const workspace = createTempWorkspace("config-version-snapshot-repo-");
  const dbPath = join(workspace, "config-version-snapshot.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigVersionSnapshotRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const snapshot = {
      versionId: "version-001",
      configPath: "/config/app/features",
      layer: "production",
      sourceId: null,
      contentJson: JSON.stringify({ enabled: true, maxRetries: 3 }),
      contentHash: "abc123def456",
      createdAt: now,
      createdBy: "admin",
      reason: "Initial version",
      parentVersionId: null,
    };

    repo.insert(snapshot);

    const retrieved = repo.getByVersionId("version-001");
    assert.ok(retrieved);
    assert.equal(retrieved.versionId, "version-001");
    assert.equal(retrieved.configPath, "/config/app/features");
    assert.equal(retrieved.layer, "production");
    assert.equal(retrieved.contentHash, "abc123def456");
    assert.equal(retrieved.createdBy, "admin");

  } finally {
    cleanupPath(workspace);
  }
});

test("ConfigVersionSnapshotRepository getByConfigPath returns all matching snapshots", () => {
  const workspace = createTempWorkspace("config-version-path-repo-");
  const dbPath = join(workspace, "config-version-path.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigVersionSnapshotRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Insert multiple versions
    for (let i = 1; i <= 3; i++) {
      repo.insert({
        versionId: `version-00${i}`,
        configPath: "/config/app/features",
        layer: "production",
        sourceId: null,
        contentJson: JSON.stringify({ version: i }),
        contentHash: `hash${i}`,
        createdAt: now,
        createdBy: "admin",
        reason: `Version ${i}`,
        parentVersionId: i > 1 ? `version-00${i - 1}` : null,
      });
    }

    const snapshots = repo.getByConfigPath("/config/app/features", "production", null);
    assert.ok(Array.isArray(snapshots));
    assert.equal(snapshots.length, 3);

  } finally {
    cleanupPath(workspace);
  }
});

test("ConfigVersionSnapshotRepository deleteOlderThan removes old snapshots", () => {
  const workspace = createTempWorkspace("config-version-delete-repo-");
  const dbPath = join(workspace, "config-version-delete.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigVersionSnapshotRepository(db.connection);

    const oldDate = "2026-01-01T00:00:00.000Z";
    const newDate = "2026-04-27T00:00:00.000Z";

    repo.insert({
      versionId: "version-old",
      configPath: "/config/app",
      layer: "production",
      sourceId: null,
      contentJson: "{}",
      contentHash: "oldhash",
      createdAt: oldDate,
      createdBy: "admin",
      reason: "Old version",
      parentVersionId: null,
    });

    repo.insert({
      versionId: "version-new",
      configPath: "/config/app",
      layer: "production",
      sourceId: null,
      contentJson: "{}",
      contentHash: "newhash",
      createdAt: newDate,
      createdBy: "admin",
      reason: "New version",
      parentVersionId: null,
    });

    const deletedCount = repo.deleteOlderThan("2026-03-01T00:00:00.000Z");
    assert.equal(deletedCount, 1);

    const remaining = repo.getByConfigPath("/config/app", "production", null);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].versionId, "version-new");

  } finally {
    cleanupPath(workspace);
  }
});

test("ConfigRollbackPointRepository insert and getByConfigPath round-trip", () => {
  const workspace = createTempWorkspace("config-rollback-repo-");
  const dbPath = join(workspace, "config-rollback.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigRollbackPointRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const rollbackPoint = {
      rollbackId: "rollback-001",
      versionId: "version-001",
      configPath: "/config/app/features",
      layer: "production",
      createdAt: now,
      createdBy: "admin",
    };

    repo.insert(rollbackPoint);

    const retrieved = repo.getByConfigPath("/config/app/features", "production");
    assert.ok(Array.isArray(retrieved));
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].rollbackId, "rollback-001");
    assert.equal(retrieved[0].versionId, "version-001");
    assert.equal(retrieved[0].createdBy, "admin");

  } finally {
    cleanupPath(workspace);
  }
});

test("ConfigRolloutRepository save and load round-trip", () => {
  const workspace = createTempWorkspace("config-rollout-repo-");
  const dbPath = join(workspace, "config-rollout.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigRolloutRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const rollout = {
      rolloutId: "rollout-001",
      configPath: "/config/app/features",
      layer: "production",
      sourceId: null,
      stagePhase: "staged",
      stagePercentage: 50,
      stageMinDurationMs: 60000,
      stageAutoProgress: true,
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 50,
      metadataJson: JSON.stringify({ rolloutName: "feature-flag-v2" }),
      healthGatesJson: JSON.stringify({ errorRateThreshold: 0.05 }),
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
    };

    repo.save(rollout);

    const retrieved = repo.load("rollout-001");
    assert.ok(retrieved);
    assert.equal(retrieved.rolloutId, "rollout-001");
    assert.equal(retrieved.configPath, "/config/app/features");
    assert.equal(retrieved.stagePhase, "staged");
    assert.equal(retrieved.stagePercentage, 50);
    assert.equal(retrieved.targetPercentage, 100);

  } finally {
    cleanupPath(workspace);
  }
});

test("ConfigRolloutRepository loadAllActive excludes completed/cancelled rollouts", () => {
  const workspace = createTempWorkspace("config-rollout-active-repo-");
  const dbPath = join(workspace, "config-rollout-active.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigRolloutRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Insert active rollout
    repo.save({
      rolloutId: "rollout-active",
      configPath: "/config/app/feature-a",
      layer: "production",
      sourceId: null,
      stagePhase: "staged",
      stagePercentage: 50,
      stageMinDurationMs: 60000,
      stageAutoProgress: true,
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 50,
      metadataJson: null,
      healthGatesJson: "{}",
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
    });

    // Insert completed rollout
    repo.save({
      rolloutId: "rollout-completed",
      configPath: "/config/app/feature-b",
      layer: "production",
      sourceId: null,
      stagePhase: "full",
      stagePercentage: 100,
      stageMinDurationMs: 0,
      stageAutoProgress: false,
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 100,
      metadataJson: null,
      healthGatesJson: "{}",
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
    });

    const activeRollouts = repo.loadAllActive();
    assert.ok(Array.isArray(activeRollouts));
    assert.equal(activeRollouts.length, 1);
    assert.equal(activeRollouts[0].rolloutId, "rollout-active");

  } finally {
    cleanupPath(workspace);
  }
});

test("ConfigRolloutRepository delete removes rollout", () => {
  const workspace = createTempWorkspace("config-rollout-delete-repo-");
  const dbPath = join(workspace, "config-rollout-delete.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ConfigRolloutRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    repo.save({
      rolloutId: "rollout-to-delete",
      configPath: "/config/app/feature-delete",
      layer: "production",
      sourceId: null,
      stagePhase: "staged",
      stagePercentage: 25,
      stageMinDurationMs: 60000,
      stageAutoProgress: true,
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 25,
      metadataJson: null,
      healthGatesJson: "{}",
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
    });

    const deletedCount = repo.delete("rollout-to-delete");
    assert.equal(deletedCount, 1);

    const retrieved = repo.load("rollout-to-delete");
    assert.equal(retrieved, undefined);

  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteConfigRolloutStore save and load implements ConfigRolloutStore interface", () => {
  const workspace = createTempWorkspace("sqlite-config-rollout-store-");
  const dbPath = join(workspace, "sqlite-config-rollout-store.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new SqliteConfigRolloutStore(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const rollout = {
      rolloutId: "store-rollout-001",
      configPath: "/config/app/feature-store",
      layer: "production",
      sourceId: "source-001",
      stage: {
        phase: "staged" as const,
        percentage: 75,
        minDurationMs: 120000,
        autoProgress: true,
      },
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 75,
      metadata: { rolloutName: "store-test" },
      healthGates: { errorRateThreshold: 0.03 },
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
      lastObservedErrorRate: null,
      lastObservedLatencyRegression: null,
      lastObservedIncidentRate: null,
      lastHealthCheckReasons: [],
    };

    store.save(rollout);

    const loaded = store.load("store-rollout-001");
    assert.ok(loaded);
    assert.equal(loaded.configPath, "/config/app/feature-store");
    assert.equal(loaded.stage.phase, "staged");
    assert.equal(loaded.stage.percentage, 75);

  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteConfigRolloutStore load returns null for non-existent rollout", () => {
  const workspace = createTempWorkspace("sqlite-config-rollout-store-null-");
  const dbPath = join(workspace, "sqlite-config-rollout-store-null.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new SqliteConfigRolloutStore(db.connection);

    const loaded = store.load("non-existent-rollout");
    assert.equal(loaded, null);

  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteConfigRolloutStore loadAll returns all rollouts", () => {
  const workspace = createTempWorkspace("sqlite-config-rollout-store-all-");
  const dbPath = join(workspace, "sqlite-config-rollout-store-all.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new SqliteConfigRolloutStore(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    store.save({
      rolloutId: "store-rollout-001",
      configPath: "/config/app/feature-a",
      layer: "production",
      sourceId: null,
      stage: { phase: "staged" as const, percentage: 50, minDurationMs: 60000, autoProgress: true },
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 50,
      metadata: undefined,
      healthGates: null,
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
      lastObservedErrorRate: null,
      lastObservedLatencyRegression: null,
      lastObservedIncidentRate: null,
      lastHealthCheckReasons: [],
    });

    store.save({
      rolloutId: "store-rollout-002",
      configPath: "/config/app/feature-b",
      layer: "production",
      sourceId: null,
      stage: { phase: "staged" as const, percentage: 100, minDurationMs: 0, autoProgress: false },
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 100,
      metadata: undefined,
      healthGates: null,
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
      lastObservedErrorRate: null,
      lastObservedLatencyRegression: null,
      lastObservedIncidentRate: null,
      lastHealthCheckReasons: [],
    });

    const allRollouts = store.loadAll();
    assert.ok(Array.isArray(allRollouts));
    assert.equal(allRollouts.length, 2);

  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteConfigRolloutStore delete removes rollout", () => {
  const workspace = createTempWorkspace("sqlite-config-rollout-store-delete-");
  const dbPath = join(workspace, "sqlite-config-rollout-store-delete.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new SqliteConfigRolloutStore(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    store.save({
      rolloutId: "store-rollout-delete",
      configPath: "/config/app/feature-delete",
      layer: "production",
      sourceId: null,
      stage: { phase: "staged" as const, percentage: 25, minDurationMs: 60000, autoProgress: true },
      startedAt: now,
      updatedAt: now,
      targetPercentage: 100,
      currentPercentage: 25,
      metadata: undefined,
      healthGates: null,
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
      lastObservedErrorRate: null,
      lastObservedLatencyRegression: null,
      lastObservedIncidentRate: null,
      lastHealthCheckReasons: [],
    });

    store.delete("store-rollout-delete");

    const loaded = store.load("store-rollout-delete");
    assert.equal(loaded, null);

  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteConfigVersionStore saveSnapshot and loadSnapshots round-trip", () => {
  const workspace = createTempWorkspace("sqlite-config-version-store-");
  const dbPath = join(workspace, "sqlite-config-version-store.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new SqliteConfigVersionStore(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    store.saveSnapshot({
      versionId: "vs-001",
      configPath: "/config/app/version-test",
      layer: "production",
      sourceId: null,
      content: { key: "value", number: 42 },
      contentHash: "hashvs001",
      createdAt: now,
      createdBy: "admin",
      reason: "Testing version store",
      parentVersionId: null,
    });

    const snapshots = store.loadSnapshots("/config/app/version-test", "production", null);
    assert.ok(Array.isArray(snapshots));
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].versionId, "vs-001");
    assert.deepEqual(snapshots[0].content, { key: "value", number: 42 });
    assert.equal(snapshots[0].contentHash, "hashvs001");

  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteConfigVersionStore saveRollbackPoint and loadRollbackPoints round-trip", () => {
  const workspace = createTempWorkspace("sqlite-config-version-store-rb-");
  const dbPath = join(workspace, "sqlite-config-version-store-rb.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new SqliteConfigVersionStore(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    store.saveRollbackPoint({
      rollbackId: "rb-001",
      versionId: "vs-001",
      configPath: "/config/app/version-test",
      layer: "production",
      createdAt: now,
      createdBy: "admin",
    });

    const rollbackPoints = store.loadRollbackPoints("/config/app/version-test", "production");
    assert.ok(Array.isArray(rollbackPoints));
    assert.equal(rollbackPoints.length, 1);
    assert.equal(rollbackPoints[0].rollbackId, "rb-001");
    assert.equal(rollbackPoints[0].versionId, "vs-001");

  } finally {
    cleanupPath(workspace);
  }
});