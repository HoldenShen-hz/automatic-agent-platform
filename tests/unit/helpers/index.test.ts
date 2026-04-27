/**
 * Unit tests for test helpers and fixtures
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync, statSync, readFileSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  unsafeCast,
  partial,
  createMockCacheStore,
  createMockCacheFacade,
  createMockCacheMetrics,
} from "../../helpers/typed-factories.js";

import {
  createMinimalTask,
  createMinimalExecution,
  createMinimalApproval,
} from "../../helpers/fixtures/base.js";

import {
  createBlockedTask,
  createApprovalRequest,
  createCompletedTask,
  createFailedTask,
} from "../../helpers/fixtures/composite.js";

import { withEnv, withEnvSync } from "../../helpers/env.js";

import {
  createTempWorkspace,
  cleanupPath,
  createFile,
  createSymlink,
} from "../../helpers/fs.js";

import { assertGolden, assertGoldenContains, assertGoldenMatches } from "../../helpers/golden.js";

import { createProcessGuard, withProcessGuard } from "../../helpers/process-guard.js";

import {
  runConcurrentInvariant,
  runConcurrentStateModification,
} from "../../helpers/concurrent-runner.js";

// ── typed-factories tests ─────────────────────────────────────────────────────

test("unsafeCast casts unknown to specified type", () => {
  const unknownValue: unknown = "hello";
  const casted: string = unsafeCast<string>(unknownValue);
  assert.equal(casted, "hello");
});

test("unsafeCast handles numeric values", () => {
  const unknownValue: unknown = 42;
  const casted: number = unsafeCast<number>(unknownValue);
  assert.equal(casted, 42);
});

test("unsafeCast handles object values", () => {
  const unknownValue: unknown = { key: "value", num: 123 };
  const casted: { key: string; num: number } = unsafeCast<{ key: string; num: number }>(unknownValue);
  assert.equal(casted.key, "value");
  assert.equal(casted.num, 123);
});

test("unsafeCast handles array values", () => {
  const unknownValue: unknown = [1, 2, 3];
  const casted: number[] = unsafeCast<number[]>(unknownValue);
  assert.deepEqual(casted, [1, 2, 3]);
});

test("unsafeCast handles null/undefined", () => {
  assert.equal(unsafeCast<string>(null), null);
  assert.equal(unsafeCast<string>(undefined), undefined);
});

test("partial creates object with defaults", () => {
  const obj = partial<{ name: string; age: number }>({ name: "test" });
  assert.equal(obj.name, "test");
  assert.equal(obj.age, undefined);
});

test("partial returns empty object when no overrides", () => {
  const obj = partial<{ a: string; b: number }>();
  assert.deepEqual(obj, {});
});

test("partial preserves all override properties", () => {
  const obj = partial<{ x: number; y: string; z: boolean }>({
    x: 1,
    y: "hello",
    z: true,
  });
  assert.equal(obj.x, 1);
  assert.equal(obj.y, "hello");
  assert.equal(obj.z, true);
});

test("createMockCacheStore returns no-op implementation", async () => {
  const store = createMockCacheStore();
  const result = await store.get("ns", "key");
  assert.equal(result.hit, false);
  assert.equal(result.value, null);
});

test("createMockCacheStore set returns void", async () => {
  const store = createMockCacheStore();
  const returned = await store.set("ns", "key", { data: "test" }, { ttl: 100 });
  assert.equal(returned, undefined);
});

test("createMockCacheStore delete returns void", async () => {
  const store = createMockCacheStore();
  const returned = await store.delete("ns", "key");
  assert.equal(returned, undefined);
});

test("createMockCacheStore invalidateByTag returns 0", async () => {
  const store = createMockCacheStore();
  const count = await store.invalidateByTag("tag");
  assert.equal(count, 0);
});

test("createMockCacheStore invalidateNamespace returns 0", async () => {
  const store = createMockCacheStore();
  const count = await store.invalidateNamespace("ns");
  assert.equal(count, 0);
});

test("createMockCacheStore cleanupExpired returns 0", async () => {
  const store = createMockCacheStore();
  const count = await store.cleanupExpired();
  assert.equal(count, 0);
});

test("createMockCacheFacade get returns not_found", async () => {
  const facade = createMockCacheFacade();
  const result = await facade.get<string>("ns", "key");
  assert.equal(result.hit, false);
});

test("createMockCacheFacade getOrCompute calls compute function", async () => {
  const facade = createMockCacheFacade();
  const result = await facade.getOrCompute("ns", "key", async () => "computed");
  assert.equal(result.value, "computed");
  assert.equal(result.fromCache, false);
});

test("createMockCacheFacade cleanupExpired returns 0", async () => {
  const facade = createMockCacheFacade();
  const count = await facade.cleanupExpired();
  assert.equal(count, 0);
});

test("createMockCacheFacade getStats returns default stats", async () => {
  const facade = createMockCacheFacade();
  const stats = await facade.getStats();
  assert.equal(stats.totalHits, 0);
  assert.equal(stats.totalMisses, 0);
  assert.equal(stats.hitRate, 0);
});

test("createMockCacheFacade resetMetrics is callable", () => {
  const facade = createMockCacheFacade();
  facade.resetMetrics(); // should not throw
});

test("createMockCacheMetrics record is callable", () => {
  const metrics = createMockCacheMetrics();
  metrics.record(); // should not throw
});

test("createMockCacheMetrics snapshot returns default structure", () => {
  const metrics = createMockCacheMetrics();
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 0);
});

test("createMockCacheMetrics reset is callable", () => {
  const metrics = createMockCacheMetrics();
  metrics.reset(); // should not throw
});

// ── fixtures/base tests ───────────────────────────────────────────────────────

test("createMinimalTask returns valid TaskRecord", () => {
  const task = createMinimalTask();
  assert.equal(task.id, "task-test-001");
  assert.equal(task.status, "queued");
  assert.equal(task.title, "Test task");
  assert.equal(task.source, "user");
  assert.equal(task.priority, "normal");
  assert.ok(task.createdAt);
  assert.ok(task.updatedAt);
  assert.equal(task.completedAt, null);
});

test("createMinimalTask applies overrides", () => {
  const task = createMinimalTask({
    id: "custom-task-id",
    status: "in_progress",
    title: "Custom title",
  });
  assert.equal(task.id, "custom-task-id");
  assert.equal(task.status, "in_progress");
  assert.equal(task.title, "Custom title");
});

test("createMinimalTask preserves non-overridden fields", () => {
  const task = createMinimalTask({ id: "new-id" });
  assert.equal(task.status, "queued");
  assert.equal(task.priority, "normal");
  assert.equal(task.source, "user");
});

test("createMinimalExecution returns valid ExecutionRecord", () => {
  const taskId = "task-test-001";
  const exec = createMinimalExecution(taskId);
  assert.equal(exec.taskId, taskId);
  assert.equal(exec.id, "exec-test-001");
  assert.equal(exec.status, "executing");
  assert.equal(exec.attempt, 1);
  assert.equal(exec.requiresApproval, 0);
});

test("createMinimalExecution applies overrides", () => {
  const taskId = "task-test-001";
  const exec = createMinimalExecution(taskId, {
    id: "custom-exec-id",
    status: "succeeded",
    attempt: 3,
  });
  assert.equal(exec.id, "custom-exec-id");
  assert.equal(exec.status, "succeeded");
  assert.equal(exec.attempt, 3);
});

test("createMinimalExecution preserves non-overridden fields", () => {
  const taskId = "task-test-001";
  const exec = createMinimalExecution(taskId, { id: "new-id" });
  assert.equal(exec.taskId, taskId);
  assert.equal(exec.workflowId, "single_agent_minimal");
  assert.equal(exec.timeoutMs, 60000);
});

test("createMinimalApproval returns valid ApprovalRecord", () => {
  const approval = createMinimalApproval();
  assert.equal(approval.id, "approval-test-001");
  assert.equal(approval.status, "requested");
  assert.equal(approval.timeoutPolicy, "remain_pending");
  assert.ok(approval.createdAt);
  assert.equal(approval.respondedAt, null);
});

test("createMinimalApproval applies overrides", () => {
  const approval = createMinimalApproval({
    id: "custom-approval-id",
    status: "approved",
  });
  assert.equal(approval.id, "custom-approval-id");
  assert.equal(approval.status, "approved");
});

// ── fixtures/composite tests ───────────────────────────────────────────────────

test("createBlockedTask returns task with pending status", () => {
  const { task, execution } = createBlockedTask("task-1", "exec-1");
  assert.equal(task.id, "task-1");
  assert.equal(task.status, "pending");
  assert.equal(execution.id, "exec-1");
  assert.equal(execution.requiresApproval, 1);
});

test("createBlockedTask applies task overrides", () => {
  const { task } = createBlockedTask("task-1", "exec-1", {
    title: "Blocked by approval",
    divisionId: "security_ops",
  });
  assert.equal(task.title, "Blocked by approval");
  assert.equal(task.divisionId, "security_ops");
});

test("createApprovalRequest returns valid ApprovalRecord", () => {
  const approval = createApprovalRequest("approval-1", "task-1", "exec-1");
  assert.equal(approval.id, "approval-1");
  assert.equal(approval.taskId, "task-1");
  assert.equal(approval.executionId, "exec-1");
  assert.equal(approval.status, "requested");
  assert.ok(approval.requestJson.includes("test approval"));
});

test("createApprovalRequest applies overrides", () => {
  const approval = createApprovalRequest("approval-1", "task-1", "exec-1", {
    status: "approved",
    responseJson: '{"approved":true}',
  });
  assert.equal(approval.status, "approved");
  assert.equal(approval.responseJson, '{"approved":true}');
});

test("createCompletedTask returns task with done status", () => {
  const { task, execution } = createCompletedTask("task-1", "exec-1");
  assert.equal(task.id, "task-1");
  assert.equal(task.status, "done");
  assert.equal(task.outputJson, '{"result":"success"}');
  assert.equal(execution.status, "succeeded");
  assert.ok(task.completedAt);
});

test("createCompletedTask applies overrides", () => {
  const { task } = createCompletedTask("task-1", "exec-1", {
    title: "Custom completed task",
  });
  assert.equal(task.title, "Custom completed task");
});

test("createFailedTask returns task with failed status", () => {
  const { task, execution } = createFailedTask("task-1", "exec-1", "task.execution_failed");
  assert.equal(task.id, "task-1");
  assert.equal(task.status, "failed");
  assert.equal(task.errorCode, "task.execution_failed");
  assert.equal(execution.status, "failed");
  assert.equal(execution.lastErrorCode, "task.execution_failed");
});

test("createFailedTask uses default error code when not provided", () => {
  const { task } = createFailedTask("task-1", "exec-1");
  assert.equal(task.errorCode, "task.execution_failed");
});

test("createFailedTask applies overrides", () => {
  const { task } = createFailedTask("task-1", "exec-1", "custom.error", {
    title: "Custom failed task",
    actualCostUsd: 1.5,
  });
  assert.equal(task.title, "Custom failed task");
  assert.equal(task.actualCostUsd, 1.5);
});

// ── env tests ──────────────────────────────────────────────────────────────────

test("withEnvSync sets environment variable during execution", () => {
  let captured: string | undefined;
  withEnvSync({ TEST_VAR: "test-value" }, () => {
    captured = process.env.TEST_VAR;
  });
  assert.equal(captured, "test-value");
});

test("withEnvSync restores original value after execution", () => {
  process.env.EXISTING_VAR = "original";
  withEnvSync({ EXISTING_VAR: "modified" }, () => {
    assert.equal(process.env.EXISTING_VAR, "modified");
  });
  assert.equal(process.env.EXISTING_VAR, "original");
});

test("withEnvSync deletes variable when original was undefined", () => {
  delete process.env.NEW_VAR;
  withEnvSync({ NEW_VAR: "temporary" }, () => {
    assert.equal(process.env.NEW_VAR, "temporary");
  });
  assert.equal(process.env.NEW_VAR, undefined);
});

test("withEnvSync handles multiple variables", () => {
  withEnvSync({ VAR_A: "a", VAR_B: "b" }, () => {
    assert.equal(process.env.VAR_A, "a");
    assert.equal(process.env.VAR_B, "b");
  });
});

test("withEnvSync reverts on error", () => {
  process.env.ERROR_TEST = "before";
  try {
    withEnvSync({ ERROR_TEST: "during" }, () => {
      throw new Error("test error");
    });
  } catch {
    // expected
  }
  assert.equal(process.env.ERROR_TEST, "before");
});

test("withEnv async sets environment variable during execution", async () => {
  let captured: string | undefined;
  await withEnv({ TEST_ASYNC_VAR: "async-value" }, async () => {
    captured = process.env.TEST_ASYNC_VAR;
  });
  assert.equal(captured, "async-value");
});

test("withEnv restores original value after async execution", async () => {
  process.env.ASYNC_ORIGINAL = "original";
  await withEnv({ ASYNC_ORIGINAL: "modified" }, async () => {
    assert.equal(process.env.ASYNC_ORIGINAL, "modified");
  });
  assert.equal(process.env.ASYNC_ORIGINAL, "original");
});

test("withEnv handles empty overrides", async () => {
  await withEnv({}, async () => {
    // should not affect environment
  });
});

// ── fs tests ──────────────────────────────────────────────────────────────────

test("createTempWorkspace creates a directory", () => {
  const workspace = createTempWorkspace("test-workspace-");
  try {
    assert.ok(existsSync(workspace));
    assert.ok(statSync(workspace).isDirectory());
  } finally {
    cleanupPath(workspace);
  }
});

test("createTempWorkspace creates directory in tmpdir", () => {
  const workspace = createTempWorkspace("test-prefix-");
  try {
    assert.ok(workspace.startsWith(tmpdir()));
  } finally {
    cleanupPath(workspace);
  }
});

test("createTempWorkspace creates unique directories", () => {
  const workspace1 = createTempWorkspace("test-unique-");
  const workspace2 = createTempWorkspace("test-unique-");
  try {
    assert.notEqual(workspace1, workspace2);
  } finally {
    cleanupPath(workspace1);
    cleanupPath(workspace2);
  }
});

test("cleanupPath removes file", () => {
  const workspace = createTempWorkspace("test-cleanup-");
  const testFile = join(workspace, "test.txt");
  writeFileSync(testFile, "content");
  assert.ok(existsSync(testFile));
  cleanupPath(testFile);
  assert.equal(existsSync(testFile), false);
  cleanupPath(workspace);
});

test("cleanupPath removes directory recursively", () => {
  const workspace = createTempWorkspace("test-deep-cleanup-");
  const subdir = join(workspace, "a", "b", "c");
  createFile(join(subdir, "file.txt"), "content");
  assert.ok(existsSync(subdir));
  cleanupPath(workspace);
  assert.equal(existsSync(workspace), false);
});

test("cleanupPath does not throw when path does not exist", () => {
  cleanupPath("/nonexistent/path/that/cannot/exist");
});

test("createFile creates file with content", () => {
  const workspace = createTempWorkspace("test-createfile-");
  try {
    const filePath = join(workspace, "subdir", "file.txt");
    createFile(filePath, "hello world");
    assert.ok(existsSync(filePath));
    assert.equal(readFileSync(filePath, "utf8"), "hello world");
  } finally {
    cleanupPath(workspace);
  }
});

test("createFile creates parent directories recursively", () => {
  const workspace = createTempWorkspace("test-mkdirs-");
  try {
    const filePath = join(workspace, "deep", "nested", "path", "file.txt");
    createFile(filePath, "content");
    assert.ok(existsSync(filePath));
  } finally {
    cleanupPath(workspace);
  }
});

test("createSymlink creates symbolic link", () => {
  const workspace = createTempWorkspace("test-symlink-");
  try {
    const targetFile = join(workspace, "target.txt");
    const linkFile = join(workspace, "link.txt");
    writeFileSync(targetFile, "target content");
    createSymlink(targetFile, linkFile);
    assert.ok(existsSync(linkFile));
    // Symlink was created by createSymlink helper
    assert.ok(existsSync(targetFile), "target should still exist");
  } finally {
    cleanupPath(workspace);
  }
});

// ── golden tests ───────────────────────────────────────────────────────────────

test("assertGoldenContains is a function", () => {
  assert.ok(typeof assertGoldenContains === "function");
});

test("assertGoldenMatches is a function", () => {
  assert.ok(typeof assertGoldenMatches === "function");
});

// ── process-guard tests ───────────────────────────────────────────────────────

test("createProcessGuard returns capture and assertNoLeaks functions", () => {
  const guard = createProcessGuard();
  assert.ok(typeof guard.capture === "function");
  assert.ok(typeof guard.assertNoLeaks === "function");
});

test("createProcessGuard capture does not throw", () => {
  const guard = createProcessGuard();
  guard.capture(); // should not throw
});

test("createProcessGuard assertNoLeaks passes when no new processes", () => {
  const guard = createProcessGuard();
  guard.capture();
  guard.assertNoLeaks(); // should not throw
});

test("withProcessGuard wraps function correctly", async () => {
  const wrapped = withProcessGuard(async () => {
    // do nothing
  });
  await wrapped(); // should not throw
});

test("withProcessGuard waits for cleanup before asserting", async () => {
  const wrapped = withProcessGuard(async () => {
    // do nothing
  });
  const start = Date.now();
  await wrapped();
  const elapsed = Date.now() - start;
  // Should have waited at least 150ms for cleanup
  assert.ok(elapsed >= 100, `Expected at least 100ms delay, got ${elapsed}ms`);
});

// ── concurrent-runner tests ───────────────────────────────────────────────────

test("runConcurrentInvariant completes all workers", async () => {
  const result = await runConcurrentInvariant(
    async (workerId) => workerId * 2,
    { concurrency: 5 }
  );
  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.values.length, 5);
  assert.ok(result.values.includes(0));
  assert.ok(result.values.includes(2));
  assert.ok(result.values.includes(4));
  assert.ok(result.values.includes(6));
  assert.ok(result.values.includes(8));
});

test("runConcurrentInvariant handles errors", async () => {
  const result = await runConcurrentInvariant(
    async (workerId) => {
      if (workerId === 2) {
        throw new Error("worker 2 failed");
      }
      return workerId;
    },
    { concurrency: 5 }
  );
  assert.equal(result.success, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.values.length, 4);
});

test("runConcurrentInvariant respects timeout", async () => {
  await assert.rejects(
    async () => {
      await runConcurrentInvariant(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 5000));
          return 1;
        },
        { concurrency: 2, timeout: 100 }
      );
    },
    /timed out/
  );
});

test("runConcurrentStateModification tracks completion", async () => {
  let counter = 0;
  const result = await runConcurrentStateModification(
    async () => {
      counter++;
    },
    { concurrency: 10 }
  );
  assert.equal(result.completed, 10);
  assert.equal(result.errors.length, 0);
});

test("runConcurrentStateModification handles errors", async () => {
  const result = await runConcurrentStateModification(
    async () => {
      throw new Error("operation failed");
    },
    { concurrency: 5 }
  );
  assert.equal(result.errors.length, 5);
  assert.equal(result.completed, 0);
});

test("runConcurrentStateModification respects timeout", async () => {
  await assert.rejects(
    async () => {
      await runConcurrentStateModification(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
        },
        { concurrency: 1, timeout: 50 }
      );
    },
    /timed out/
  );
});
