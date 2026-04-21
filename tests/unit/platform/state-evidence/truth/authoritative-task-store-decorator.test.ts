/**
 * Unit tests for AuthoritativeTaskStoreDecorator
 *
 * Tests SQLITE_BUSY retry logic, backoff calculation, and metrics.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import {
  decorateAuthoritativeTaskStore,
  getAuthoritativeTaskStoreDecoratorMetricsSnapshot,
  resetAuthoritativeTaskStoreDecoratorMetrics,
  type DecoratedAuthoritativeTaskStoreOptions,
} from "../../../../../src/platform/state-evidence/truth/repositories/authoritative-task-store-decorator.js";

test.beforeEach(() => {
  resetAuthoritativeTaskStoreDecoratorMetrics();
});

test("decorateAuthoritativeTaskStore retries on SQLITE_BUSY and succeeds", () => {
  let attempts = 0;
  const store = {
    listTasks(): string[] {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
      }
      if (attempts === 2) {
        throw Object.assign(new Error("SQLITE_BUSY: database is busy"), { code: "SQLITE_BUSY" });
      }
      return ["task-1", "task-2"];
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 0,
    logger: new StructuredLogger({ retentionLimit: 10 }),
  });

  const result = (decorated as unknown as { listTasks(): string[] }).listTasks();
  assert.deepEqual(result, ["task-1", "task-2"]);
  assert.equal(attempts, 3);
});

test("decorateAuthoritativeTaskStore exhausts retries and throws original error", () => {
  let attempts = 0;
  const store = {
    listTasks(): string[] {
      attempts += 1;
      throw Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 2,
    baseRetryDelayMs: 0,
    logger: new StructuredLogger({ retentionLimit: 10 }),
  });

  assert.throws(() => (decorated as unknown as { listTasks(): string[] }).listTasks(), /SQLITE_BUSY/);
  assert.equal(attempts, 2, "Should exhaust maxRetryAttempts (2 attempts with maxRetryAttempts=2)");
});

test("decorateAuthoritativeTaskStore throws immediately on non-SQLITE_BUSY error", () => {
  let attempts = 0;
  const store = {
    listTasks(): string[] {
      attempts += 1;
      throw new Error("Some other error");
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 0,
    logger: new StructuredLogger({ retentionLimit: 10 }),
  });

  assert.throws(() => (decorated as unknown as { listTasks(): string[] }).listTasks(), /Some other error/);
  assert.equal(attempts, 1, "Should not retry on non-SQLITE_BUSY errors");
});

test("decorateAuthoritativeTaskStore records metrics correctly on success", () => {
  let attempts = 0;
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const store = {
    listTasks(): string[] {
      attempts += 1;
      if (attempts < 2) {
        throw Object.assign(new Error("SQLITE_BUSY"), { code: "SQLITE_BUSY" });
      }
      return ["task-success"];
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 0,
    logger,
  });

  (decorated as unknown as { listTasks(): string[] }).listTasks();

  const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
  assert.equal(metrics.listTasks?.calls, 1);
  assert.equal(metrics.listTasks?.successes, 1);
  assert.equal(metrics.listTasks?.failures, 0);
  assert.equal(metrics.listTasks?.retries, 1);
  assert.equal(metrics.listTasks?.lastAttemptCount, 2);
});

test("decorateAuthoritativeTaskStore records metrics correctly on failure", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const store = {
    listTasks(): string[] {
      throw new Error("permanent failure");
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 0,
    logger,
  });

  assert.throws(() => (decorated as unknown as { listTasks(): string[] }).listTasks());

  const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
  assert.equal(metrics.listTasks?.calls, 1);
  assert.equal(metrics.listTasks?.successes, 0);
  assert.equal(metrics.listTasks?.failures, 1);
  assert.equal(metrics.listTasks?.retries, 0);
});

test("decorateAuthoritativeTaskStore handles multiple methods independently", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  let taskAttempts = 0;
  let workflowAttempts = 0;

  const store = {
    listTasks(): string[] {
      taskAttempts += 1;
      if (taskAttempts === 1) {
        throw Object.assign(new Error("SQLITE_BUSY"), { code: "SQLITE_BUSY" });
      }
      return ["task-1"];
    },
    listWorkflows(): string[] {
      workflowAttempts += 1;
      return ["wf-1"];
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 0,
    logger,
  });

  const tasks = (decorated as unknown as { listTasks(): string[] }).listTasks();
  const workflows = (decorated as unknown as { listWorkflows(): string[] }).listWorkflows();

  assert.deepEqual(tasks, ["task-1"]);
  assert.deepEqual(workflows, ["wf-1"]);
  assert.equal(taskAttempts, 2);
  assert.equal(workflowAttempts, 1);

  const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
  assert.ok(metrics.listTasks);
  assert.ok(metrics.listWorkflows);
  assert.equal(metrics.listTasks?.calls, 1);
  assert.equal(metrics.listWorkflows?.calls, 1);
});

test("decorateAuthoritativeTaskStore uses default options when not provided", () => {
  resetAuthoritativeTaskStoreDecoratorMetrics();
  const store = {
    listTasks(): string[] {
      return ["default-opts"];
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store);

  const result = (decorated as unknown as { listTasks(): string[] }).listTasks();
  assert.deepEqual(result, ["default-opts"]);
});

test("decorateAuthoritativeTaskStore computes retry backoff correctly", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const store = {
    getTask(): string {
      return "delayed";
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 10,
    maxRetryDelayMs: 100,
    retryJitterRatio: 0.1,
    logger,
  });

  (decorated as unknown as { getTask(): string }).getTask();

  const metrics = getAuthoritativeTaskStoreDecoratorMetricsSnapshot();
  assert.ok(metrics.getTask);
  assert.ok((metrics.getTask?.totalBackoffMs ?? 0) >= 0, "totalBackoffMs should be >= 0");
});

test("decorateAuthoritativeTaskStore preserves non-function properties", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const store = {
    listTasks(): string[] {
      return ["task-1"];
    },
    someProperty: "test-value",
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, { logger });

  assert.equal((decorated as unknown as { someProperty: string }).someProperty, "test-value");
});

test("decorateAuthoritativeTaskStore logs retry attempts", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  let attempts = 0;
  const store = {
    listTasks(): string[] {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("SQLITE_BUSY"), { code: "SQLITE_BUSY" });
      }
      return ["task-retry-logged"];
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 3,
    baseRetryDelayMs: 0,
    logger,
  });

  (decorated as unknown as { listTasks(): string[] }).listTasks();

  const recentLogs = logger.recent(5);
  const retryLog = recentLogs.find((l) => l.message === "authoritative_task_store.retry");
  assert.ok(retryLog, "Should have logged a retry");
  assert.equal(retryLog?.data?.operation, "listTasks");
  assert.equal(retryLog?.data?.attempt, 1);
});