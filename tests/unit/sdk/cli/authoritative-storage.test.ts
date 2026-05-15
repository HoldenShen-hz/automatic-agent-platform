import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  deriveCliWorkspaceRoot,
  openCliAuthoritativeStorageContext,
  openCliAuthoritativeStorageContextAsync,
  withCliStorage,
} from "../../../../src/sdk/cli/authoritative-storage.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import type { SqliteAuthoritativeStorageContext } from "../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";

test("cli authoritative storage context binds store and sql handle from AA_DB_PATH", () => {
  const workspace = createTempWorkspace("aa-cli-storage-context-");
  const dbPath = join(workspace, "runtime.db");
  const previousDbPath = process.env.AA_DB_PATH;

  try {
    process.env.AA_DB_PATH = dbPath;
    const storage = openCliAuthoritativeStorageContext();
    const sqliteStorage = storage as SqliteAuthoritativeStorageContext;
    storage.migrate();
    sqliteStorage.store.insertTask({
      id: "task-cli-context",
      parentId: null,
      rootId: "task-cli-context",
      divisionId: "general_ops",
      title: "cli context task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-09T01:00:00.000Z",
      updatedAt: "2026-04-09T01:00:00.000Z",
      completedAt: null,
    });

    assert.equal(sqliteStorage.sql.filePath, dbPath);
    assert.equal(sqliteStorage.sqlite.filePath, dbPath);
    assert.equal(sqliteStorage.store.listTasks(5)[0]?.id, "task-cli-context");
    assert.doesNotThrow(() => {
      storage.close();
      storage.close();
    });
  } finally {
    if (previousDbPath == null) {
      delete process.env.AA_DB_PATH;
    } else {
      process.env.AA_DB_PATH = previousDbPath;
    }
    cleanupPath(workspace);
  }
});

test("cli authoritative storage async context opens sqlite storage without changing the sync path", async () => {
  const workspace = createTempWorkspace("aa-cli-storage-context-async-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const storage = await openCliAuthoritativeStorageContextAsync(dbPath);
    await storage.migrate();
    assert.equal(storage.driver, "sqlite");
    assert.equal(storage.store.listTasks(5).length, 0);
    await storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("cli authoritative storage async context fail-closes postgres-backed authoritative task store access", async () => {
  const workspace = createTempWorkspace("aa-cli-storage-context-postgres-");
  const dbPath = join(workspace, "runtime.db");
  const previousEnv = {
    AA_STORAGE_DRIVER: process.env.AA_STORAGE_DRIVER,
    AA_STORAGE_POSTGRES_DSN: process.env.AA_STORAGE_POSTGRES_DSN,
  };

  try {
    process.env.AA_STORAGE_DRIVER = "postgres";
    process.env.AA_STORAGE_POSTGRES_DSN = "postgresql://agent:secret@postgres.internal/agent_db?sslmode=require";

    await assert.rejects(
      async () => openCliAuthoritativeStorageContextAsync(dbPath),
      /storage\.backend_config_invalid.*storage\.postgres/,
    );
  } finally {
    if (previousEnv.AA_STORAGE_DRIVER == null) {
      delete process.env.AA_STORAGE_DRIVER;
    } else {
      process.env.AA_STORAGE_DRIVER = previousEnv.AA_STORAGE_DRIVER;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_DSN == null) {
      delete process.env.AA_STORAGE_POSTGRES_DSN;
    } else {
      process.env.AA_STORAGE_POSTGRES_DSN = previousEnv.AA_STORAGE_POSTGRES_DSN;
    }
    cleanupPath(workspace);
  }
});

test("cli authoritative storage sync context uses postgres dual-run shadow sqlite for authoritative access", () => {
  const workspace = createTempWorkspace("aa-cli-storage-context-shadow-");
  const dbPath = join(workspace, "runtime.db");
  const shadowDbPath = join(workspace, "shadow.db");
  const previousEnv = {
    AA_DB_PATH: process.env.AA_DB_PATH,
    AA_STORAGE_DRIVER: process.env.AA_STORAGE_DRIVER,
    AA_STORAGE_POSTGRES_DSN: process.env.AA_STORAGE_POSTGRES_DSN,
    AA_STORAGE_POSTGRES_DUAL_RUN: process.env.AA_STORAGE_POSTGRES_DUAL_RUN,
    AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH,
  };

  try {
    process.env.AA_DB_PATH = dbPath;
    process.env.AA_STORAGE_DRIVER = "postgres";
    process.env.AA_STORAGE_POSTGRES_DSN = "postgresql://agent:secret@postgres.internal/agent_db?sslmode=require";
    process.env.AA_STORAGE_POSTGRES_DUAL_RUN = "true";
    process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH = shadowDbPath;

    const storage = openCliAuthoritativeStorageContext();
    const sqliteStorage = storage as SqliteAuthoritativeStorageContext;
    storage.migrate();
    sqliteStorage.store.insertTask({
      id: "task-cli-shadow",
      parentId: null,
      rootId: "task-cli-shadow",
      divisionId: "general_ops",
      title: "cli shadow task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-12T01:00:00.000Z",
      updatedAt: "2026-04-12T01:00:00.000Z",
      completedAt: null,
    });

    assert.equal(storage.driver, "sqlite");
    assert.equal(sqliteStorage.sql.filePath, shadowDbPath);
    assert.equal(sqliteStorage.store.listTasks(5)[0]?.id, "task-cli-shadow");
    storage.close();
  } finally {
    if (previousEnv.AA_DB_PATH == null) {
      delete process.env.AA_DB_PATH;
    } else {
      process.env.AA_DB_PATH = previousEnv.AA_DB_PATH;
    }
    if (previousEnv.AA_STORAGE_DRIVER == null) {
      delete process.env.AA_STORAGE_DRIVER;
    } else {
      process.env.AA_STORAGE_DRIVER = previousEnv.AA_STORAGE_DRIVER;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_DSN == null) {
      delete process.env.AA_STORAGE_POSTGRES_DSN;
    } else {
      process.env.AA_STORAGE_POSTGRES_DSN = previousEnv.AA_STORAGE_POSTGRES_DSN;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_DUAL_RUN == null) {
      delete process.env.AA_STORAGE_POSTGRES_DUAL_RUN;
    } else {
      process.env.AA_STORAGE_POSTGRES_DUAL_RUN = previousEnv.AA_STORAGE_POSTGRES_DUAL_RUN;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH == null) {
      delete process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH;
    } else {
      process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH = previousEnv.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH;
    }
    cleanupPath(workspace);
  }
});

test("cli authoritative storage sync context fail-closes postgres mode without shadow sqlite", () => {
  const workspace = createTempWorkspace("aa-cli-storage-context-shadow-required-");
  const dbPath = join(workspace, "runtime.db");
  const previousEnv = {
    AA_DB_PATH: process.env.AA_DB_PATH,
    AA_STORAGE_DRIVER: process.env.AA_STORAGE_DRIVER,
    AA_STORAGE_POSTGRES_DSN: process.env.AA_STORAGE_POSTGRES_DSN,
    AA_STORAGE_POSTGRES_DUAL_RUN: process.env.AA_STORAGE_POSTGRES_DUAL_RUN,
    AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH,
  };

  try {
    process.env.AA_DB_PATH = dbPath;
    process.env.AA_STORAGE_DRIVER = "postgres";
    process.env.AA_STORAGE_POSTGRES_DSN = "postgresql://agent:secret@postgres.internal/agent_db?sslmode=require";
    delete process.env.AA_STORAGE_POSTGRES_DUAL_RUN;
    delete process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH;

    assert.throws(
      () => openCliAuthoritativeStorageContext(),
      /storage\.backend_config_invalid.*postgres.*dual_run_required/,
    );
  } finally {
    if (previousEnv.AA_DB_PATH == null) {
      delete process.env.AA_DB_PATH;
    } else {
      process.env.AA_DB_PATH = previousEnv.AA_DB_PATH;
    }
    if (previousEnv.AA_STORAGE_DRIVER == null) {
      delete process.env.AA_STORAGE_DRIVER;
    } else {
      process.env.AA_STORAGE_DRIVER = previousEnv.AA_STORAGE_DRIVER;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_DSN == null) {
      delete process.env.AA_STORAGE_POSTGRES_DSN;
    } else {
      process.env.AA_STORAGE_POSTGRES_DSN = previousEnv.AA_STORAGE_POSTGRES_DSN;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_DUAL_RUN == null) {
      delete process.env.AA_STORAGE_POSTGRES_DUAL_RUN;
    } else {
      process.env.AA_STORAGE_POSTGRES_DUAL_RUN = previousEnv.AA_STORAGE_POSTGRES_DUAL_RUN;
    }
    if (previousEnv.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH == null) {
      delete process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH;
    } else {
      process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH = previousEnv.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH;
    }
    cleanupPath(workspace);
  }
});

test("deriveCliWorkspaceRoot returns workspace parent for standard sqlite layout", () => {
  assert.equal(
    deriveCliWorkspaceRoot("/tmp/aa-workspace/data/sqlite/runtime.db"),
    "/tmp/aa-workspace",
  );
  assert.equal(
    deriveCliWorkspaceRoot("/tmp/custom/runtime.db"),
    "/tmp/custom",
  );
});

test("withCliStorage migrates and closes the storage automatically", () => {
  const workspace = createTempWorkspace("aa-cli-storage-with-helper-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const result = withCliStorage((storage) => {
      const sqliteStorage = storage as SqliteAuthoritativeStorageContext;
      sqliteStorage.store.insertTask({
        id: "task-cli-helper",
        parentId: null,
        rootId: "task-cli-helper",
        divisionId: "general_ops",
        title: "cli helper task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: "2026-04-12T03:00:00.000Z",
        updatedAt: "2026-04-12T03:00:00.000Z",
        completedAt: null,
      });
      return sqliteStorage.store.listTasks(5)[0]?.id ?? null;
    }, { dbPath });

    assert.equal(result, "task-cli-helper");

    const verify = openCliAuthoritativeStorageContext(dbPath) as SqliteAuthoritativeStorageContext;
    verify.migrate();
    assert.equal(verify.store.listTasks(5)[0]?.id, "task-cli-helper");
    verify.close();
  } finally {
    cleanupPath(workspace);
  }
});
