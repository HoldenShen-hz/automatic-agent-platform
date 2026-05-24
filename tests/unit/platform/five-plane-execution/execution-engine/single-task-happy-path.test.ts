import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { openAuthoritativeStorageContext } from "../../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { runSingleTaskExecution } from "../../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";

async function createTempDbPath(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), "single-task-test-"));
  return join(tmp, `test-${randomUUID()}.db`);
}

test("runSingleTaskExecution completes the canonical happy path snapshot", async () => {
  const dbPath = await createTempDbPath();

  try {
    const result = await runSingleTaskExecution({
      dbPath,
      title: "Test task",
      request: "say hello",
      stepOutputOverride: {
        summary: "Test summary",
        result: "Hello world",
      },
    });

    assert.equal(result.task.status, "done");
    assert.ok(result.workflow);
    assert.ok(result.session);
    const executions = "executions" in result ? result.executions : result.execution == null ? [] : [result.execution];
    assert.ok(executions.length > 0);
    assert.ok(result.stepOutputs.length > 0);
  } finally {
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.close();
  }
});

test("runSingleTaskExecution persists synthetic output when stepOutputOverride is provided", async () => {
  const dbPath = await createTempDbPath();

  try {
    const result = await runSingleTaskExecution({
      dbPath,
      title: "Synthetic output",
      request: "use override",
      stepOutputOverride: {
        summary: "Synthetic test",
        result: "Custom synthetic result",
      },
    });

    const output = JSON.parse(result.task.outputJson ?? "{}") as { result?: string };
    const firstStepOutput = result.stepOutputs[0];
    assert.equal(output.result, "Custom synthetic result");
    assert.ok(firstStepOutput);
    assert.equal(firstStepOutput.status, "succeeded");
  } finally {
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.close();
  }
});

test("runSingleTaskExecution keeps execution and precheck evidence aligned with the current return contract", async () => {
  const dbPath = await createTempDbPath();

  try {
    const result = await runSingleTaskExecution({
      dbPath,
      title: "Tenant task",
      request: "tenant task",
      tenantId: "test-tenant-123",
      stepOutputOverride: {
        summary: "Tenant summary",
        result: "Tenant result",
      },
    });

    const executions = "executions" in result ? result.executions : result.execution == null ? [] : [result.execution];
    const prechecks = "prechecks" in result ? result.prechecks : [];
    const execution = executions[0];
    const precheck = prechecks[0];
    assert.equal(result.task.tenantId, "test-tenant-123");
    assert.ok(execution);
    assert.ok(precheck);
    assert.equal(execution.taskId, result.task.id);
    assert.equal(precheck.executionId, execution.id);
  } finally {
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.close();
  }
});
