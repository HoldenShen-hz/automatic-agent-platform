/**
 * Unit tests for tests/helpers/repository-harness.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  createTempWorkspace,
  cleanupPath,
} from "../../helpers/fs.js";
import {
  createRepositoryHarness,
  createRepositoryWithStoreHarness,
} from "../../helpers/repository-harness.js";

describe("repository-harness", () => {
  describe("createRepositoryHarness", () => {
    it("should create a workspace directory", () => {
      const harness = createRepositoryHarness("repo-test-");
      try {
        assert.ok(existsSync(harness.workspace), "workspace should exist");
        assert.ok(harness.workspace.includes("repo-test-"), "workspace should have prefix");
      } finally {
        harness.cleanup();
      }
    });

    it("should create a database file at dbPath", () => {
      const harness = createRepositoryHarness("repo-db-");
      try {
        assert.ok(existsSync(harness.dbPath), "dbPath should exist");
        assert.ok(harness.dbPath.endsWith(".db"), "dbPath should be a .db file");
      } finally {
        harness.cleanup();
      }
    });

    it("should return a connected database instance", () => {
      const harness = createRepositoryHarness("repo-connected-");
      try {
        assert.ok(harness.db, "db should be defined");
        // Should be able to run a simple query
        const result = harness.db.connection.prepare("SELECT 1 as val").get() as { val: number };
        assert.strictEqual(result.val, 1);
      } finally {
        harness.cleanup();
      }
    });

    it("should have migrated the database", () => {
      const harness = createRepositoryHarness("repo-migrated-");
      try {
        // Check that tables exist by querying sqlite_master
        const tables = harness.db.connection
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all() as Array<{ name: string }>;
        assert.ok(tables.length > 0, "database should have tables");
      } finally {
        harness.cleanup();
      }
    });

    it("should cleanup remove workspace", () => {
      const harness = createRepositoryHarness("repo-cleanup-");
      const workspace = harness.workspace;
      harness.cleanup();
      assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
    });

    it("should use custom prefix", () => {
      const harness = createRepositoryHarness("my-custom-prefix-");
      try {
        assert.ok(harness.workspace.includes("my-custom-prefix-"));
      } finally {
        harness.cleanup();
      }
    });

    it("should use default prefix when not specified", () => {
      const harness = createRepositoryHarness();
      try {
        assert.ok(harness.workspace.includes("aa-repo-"), "should use default prefix");
      } finally {
        harness.cleanup();
      }
    });

    it("should allow multiple harnesses with unique workspaces", () => {
      const harness1 = createRepositoryHarness("multi-1-");
      const harness2 = createRepositoryHarness("multi-2-");
      try {
        assert.notStrictEqual(harness1.workspace, harness2.workspace);
        assert.ok(existsSync(harness1.workspace));
        assert.ok(existsSync(harness2.workspace));
      } finally {
        harness1.cleanup();
        harness2.cleanup();
      }
    });
  });

  describe("createRepositoryWithStoreHarness", () => {
    it("should create a harness basic properties", () => {
      const harness = createRepositoryWithStoreHarness("repo-store-");
      try {
        assert.ok(harness.store, "store should be defined");
        assert.ok(harness.db, "db should still be defined");
        assert.deepEqual(harness.store.listTasks(10), []);
      } finally {
        harness.cleanup();
      }
    });
  });
});
