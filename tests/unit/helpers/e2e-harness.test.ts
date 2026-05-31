/**
 * Unit tests for tests/helpers/e2e-harness.ts
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  createTempWorkspace,
  cleanupPath,
} from "../../helpers/fs.js";
import {
  createE2EHarness,
  createSeededE2EHarness,
} from "../../helpers/e2e-harness.js";

describe("e2e-harness", () => {
  describe("createE2EHarness", () => {
    it("should create a workspace directory", () => {
      const harness = createE2EHarness("e2e-test-");
      try {
        assert.ok(existsSync(harness.workspace), "workspace should exist");
        assert.ok(harness.workspace.includes("e2e-test-"), "workspace should have prefix");
      } finally {
        harness.cleanup();
      }
    });

    it("should create a database file at dbPath", () => {
      const harness = createE2EHarness("e2e-db-");
      try {
        assert.ok(existsSync(harness.dbPath), "dbPath should exist");
        assert.ok(harness.dbPath.endsWith(".db"), "dbPath should be a .db file");
      } finally {
        harness.cleanup();
      }
    });

    it("should return a connected database instance", () => {
      const harness = createE2EHarness("e2e-connected-");
      try {
        assert.ok(harness.db, "db should be defined");
      } finally {
        harness.cleanup();
      }
    });

    it("should have an AuthoritativeTaskStore instance", () => {
      const harness = createE2EHarness("e2e-store-");
      try {
        assert.ok(harness.store, "store should be defined");
        // Verify store works
        const tasks = harness.store.listTasks(10);
        assert.ok(Array.isArray(tasks));
      } finally {
        harness.cleanup();
      }
    });

    it("createE2EHarness cleanup should remove workspace", () => {
      const harness = createE2EHarness("e2e-cleanup-");
      const workspace = harness.workspace;
      harness.cleanup();
      assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
    });

    it("should use custom prefix", () => {
      const harness = createE2EHarness("my-e2e-");
      try {
        assert.ok(harness.workspace.includes("my-e2e-"));
      } finally {
        harness.cleanup();
      }
    });

    it("should allow multiple harnesses with unique workspaces", () => {
      const harness1 = createE2EHarness("multi-1-");
      const harness2 = createE2EHarness("multi-2-");
      try {
        assert.notStrictEqual(harness1.workspace, harness2.workspace);
        assert.ok(existsSync(harness1.workspace));
        assert.ok(existsSync(harness2.workspace));
      } finally {
        harness1.cleanup();
        harness2.cleanup();
      }
    });

    it("should default to aa-e2e- prefix", () => {
      const harness = createE2EHarness();
      try {
        assert.ok(harness.workspace.includes("aa-e2e-"), "should use default prefix");
      } finally {
        harness.cleanup();
      }
    });
  });

  describe("createSeededE2EHarness", () => {
    function findTaskById(store: AuthoritativeTaskStore, taskId: string) {
      const tasks = store.listTasks(100);
      return tasks.find(t => t.id === taskId) ?? null;
    }

    it("should create a harness with seeded task and execution", () => {
      const harness = createSeededE2EHarness("e2e-seeded-");
      try {
        assert.ok(harness.store, "store should be defined");
        // Should have seeded task
        const tasks = harness.store.listTasks(10);
        assert.ok(tasks.length > 0, "should have seeded tasks");
      } finally {
        harness.cleanup();
      }
    });

    it("should use default taskId when not provided", () => {
      const harness = createSeededE2EHarness("e2e-seeded-default-");
      try {
        const task = findTaskById(harness.store, "task-e2e-001");
        assert.ok(task, "task with default id should exist");
        assert.strictEqual(task.title, "E2E test task");
      } finally {
        harness.cleanup();
      }
    });

    it("should use default executionId when not provided", () => {
      const harness = createSeededE2EHarness("e2e-seeded-exec-");
      try {
        const executions = harness.store.listExecutionsByTask("task-e2e-001");
        assert.strictEqual(executions.length, 1);
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.id, "exec-e2e-001");
      } finally {
        harness.cleanup();
      }
    });

    it("should allow custom taskId and executionId", () => {
      const harness = createSeededE2EHarness("e2e-seeded-custom-", {
        taskId: "custom-e2e-task",
        executionId: "custom-e2e-exec",
      });
      try {
        const task = findTaskById(harness.store, "custom-e2e-task");
        assert.ok(task, "custom task should exist");
        const executions = harness.store.listExecutionsByTask("custom-e2e-task");
        assert.strictEqual(executions.length, 1);
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.id, "custom-e2e-exec");
      } finally {
        harness.cleanup();
      }
    });

    it("should create seeded task with in_progress status", () => {
      const harness = createSeededE2EHarness("e2e-seeded-status-");
      try {
        const task = findTaskById(harness.store, "task-e2e-001");
        assert.ok(task, "task should exist");
        assert.strictEqual(task.status, "in_progress");
      } finally {
        harness.cleanup();
      }
    });

    it("should create seeded execution with executing status", () => {
      const harness = createSeededE2EHarness("e2e-seeded-exec-status-");
      try {
        const executions = harness.store.listExecutionsByTask("task-e2e-001");
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.status, "executing");
      } finally {
        harness.cleanup();
      }
    });

    it("should link seeded execution to task via taskId", () => {
      const harness = createSeededE2EHarness("e2e-seeded-link-");
      try {
        const executions = harness.store.listExecutionsByTask("task-e2e-001");
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.strictEqual(exec.taskId, "task-e2e-001");
      } finally {
        harness.cleanup();
      }
    });

    it("should set seeded execution traceId with prefix", () => {
      const harness = createSeededE2EHarness("e2e-seeded-trace-");
      try {
        const executions = harness.store.listExecutionsByTask("task-e2e-001");
        const exec = executions[0];
        assert.ok(exec, "execution should exist");
        assert.ok(exec.traceId.startsWith("trace-"), "traceId should start with trace-");
      } finally {
        harness.cleanup();
      }
    });

    it("should set seeded task divisionId to general_ops", () => {
      const harness = createSeededE2EHarness("e2e-seeded-div-");
      try {
        const task = findTaskById(harness.store, "task-e2e-001");
        assert.ok(task, "task should exist");
        assert.strictEqual(task.divisionId, "general_ops");
      } finally {
        harness.cleanup();
      }
    });

    it("createSeededE2EHarness cleanup should remove workspace", () => {
      const harness = createSeededE2EHarness("e2e-seeded-cleanup-");
      const workspace = harness.workspace;
      harness.cleanup();
      assert.ok(!existsSync(workspace), "workspace should be removed after cleanup");
    });
  });
});

// Import for type only
import type { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
