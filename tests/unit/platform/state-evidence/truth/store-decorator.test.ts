import assert from "node:assert/strict";
import test from "node:test";

import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import {
  decorateAuthoritativeTaskStore,
} from "../../../../../src/platform/state-evidence/truth/repositories/authoritative-task-store-decorator.js";

test.beforeEach(() => {
  // Per-instance metrics are used now; nothing global to reset here.
});

test("authoritative task store decorator retries SQLITE_BUSY failures and returns the underlying result", () => {
  let attempts = 0;
  const store = {
    listTasks(): string[] {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("SQLITE_BUSY: database is locked"), { code: "SQLITE_BUSY" });
      }
      return ["task-1"];
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, {
    maxRetryAttempts: 2,
    baseRetryDelayMs: 0,
    logger: new StructuredLogger({ retentionLimit: 10 }),
  });

  assert.deepEqual((decorated as unknown as { listTasks(): string[] }).listTasks(), ["task-1"]);
  assert.equal(attempts, 2);
  const metrics = decorated.getMetricsSnapshot();
  assert.equal(metrics.listTasks?.calls, 1);
  assert.equal(metrics.listTasks?.retries, 1);
  assert.equal(metrics.listTasks?.successes, 1);
  assert.equal(metrics.listTasks?.failures, 0);
  assert.equal(metrics.listTasks?.lastAttemptCount, 2);
});

test("authoritative task store decorator records failed operations", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const store = {
    listTasks(): string[] {
      throw new Error("boom");
    },
  } as unknown as AuthoritativeTaskStore;

  const decorated = decorateAuthoritativeTaskStore(store, { logger });

  assert.throws(() => (decorated as unknown as { listTasks(): string[] }).listTasks(), /boom/);
  const entry = logger.recent(1)[0];
  assert.equal(entry?.message, "authoritative_task_store.operation_failed");
  assert.equal(entry?.data?.operation, "listTasks");
  const metrics = decorated.getMetricsSnapshot();
  assert.equal(metrics.listTasks?.calls, 1);
  assert.equal(metrics.listTasks?.failures, 1);
  assert.equal(metrics.listTasks?.successes, 0);
});
