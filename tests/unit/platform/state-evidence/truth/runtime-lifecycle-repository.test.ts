import test from "node:test";
import assert from "node:assert/strict";

import type { ApprovalRecord, EventRecord } from "../../../../../src/platform/contracts/types/domain.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import {
  AuthoritativeTaskStoreRuntimeLifecycleRepository,
  ObservedRuntimeLifecycleRepository,
  RetryingRuntimeLifecycleRepository,
  type RuntimeLifecycleRepository,
} from "../../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";

const APPROVAL_RECORD: ApprovalRecord = {
  id: "approval-1",
  taskId: "task-1",
  executionId: "exec-1",
  status: "requested",
  requestJson: "{\"ok\":true}",
  responseJson: null,
  timeoutPolicy: "reject",
  createdAt: "2026-04-11T00:00:00.000Z",
  respondedAt: null,
};

function createRepositoryStub(
  overrides: Partial<RuntimeLifecycleRepository> = {},
): RuntimeLifecycleRepository {
  return {
    updateTaskStatus(): void {},
    updateTaskStatusCas(): number { return 1; },
    updateTaskOutput(): void {},
    updateWorkflowState(): void {},
    updateSessionStatus(): void {},
    updateExecutionStatus(): void {},
    createTier1StatusEvent(input): EventRecord {
      return {
        id: "evt-1",
        taskId: input.taskId,
        sessionId: null,
        executionId: input.executionId,
        eventType: input.eventType,
        eventTier: "tier_1",
        payloadJson: JSON.stringify(input.payload),
        traceId: input.traceId,
        createdAt: "2026-04-11T00:00:00.000Z",
      };
    },
    insertApproval(): void {},
    getApproval(): ApprovalRecord | null {
      return APPROVAL_RECORD;
    },
    listApprovalsByTask(): ApprovalRecord[] {
      return [APPROVAL_RECORD];
    },
    updateApprovalDecision(): void {},
    insertEvent(event): EventRecord {
      return {
        id: event.id,
        taskId: event.taskId,
        sessionId: event.sessionId ?? null,
        executionId: event.executionId,
        eventType: event.eventType,
        eventTier: event.eventTier ?? "tier_1",
        payloadJson: event.payloadJson,
        traceId: event.traceId,
        createdAt: event.createdAt,
      };
    },
    ...overrides,
  };
}

test("authoritative runtime lifecycle repository delegates task status updates to the store", () => {
  let seen: unknown[] = [];
  const storeLike = {
    task: {
      updateTaskStatus(...args: unknown[]) {
        seen = args;
      },
    },
  } as unknown as AuthoritativeTaskStore;

  const repository = new AuthoritativeTaskStoreRuntimeLifecycleRepository(storeLike);
  repository.updateTaskStatus(
    "task-1",
    "failed",
    "2026-04-11T00:00:00.000Z",
    "task.failed",
    "2026-04-11T00:01:00.000Z",
  );

  assert.deepEqual(seen, [
    "task-1",
    "failed",
    "2026-04-11T00:00:00.000Z",
    "task.failed",
    "2026-04-11T00:01:00.000Z",
  ]);
});

test("retrying runtime lifecycle repository retries SQLITE_BUSY operations", () => {
  let attempts = 0;
  const repository = new RetryingRuntimeLifecycleRepository(
    createRepositoryStub({
      updateTaskStatus(): void {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error("SQLITE_BUSY: database is locked"), {
            code: "SQLITE_BUSY",
          });
        }
      },
    }),
    { maxAttempts: 2 },
  );

  repository.updateTaskStatus("task-1", "in_progress", "2026-04-11T00:00:00.000Z");

  assert.equal(attempts, 2);
});

test("observed runtime lifecycle repository records successful operations", () => {
  const logger = new StructuredLogger({ retentionLimit: 4 });
  const repository = new ObservedRuntimeLifecycleRepository(
    createRepositoryStub({
      listApprovalsByTask(taskId: string): ApprovalRecord[] {
        assert.equal(taskId, "task-1");
        return [APPROVAL_RECORD];
      },
    }),
    logger,
  );

  const approvals = repository.listApprovalsByTask("task-1");
  const entry = logger.recent(1)[0];

  assert.equal(approvals.length, 1);
  assert.equal(entry?.message, "runtime_lifecycle_repository.operation");
  assert.equal(entry?.level, "debug");
  assert.equal(entry?.data?.operation, "listApprovalsByTask");
  assert.equal(entry?.data?.ok, true);
});

test("observed runtime lifecycle repository records failed operations", () => {
  const logger = new StructuredLogger({ retentionLimit: 4 });
  const repository = new ObservedRuntimeLifecycleRepository(
    createRepositoryStub({
      getApproval(): ApprovalRecord | null {
        throw new Error("boom");
      },
    }),
    logger,
  );

  assert.throws(() => repository.getApproval("approval-1"), /boom/);

  const entry = logger.recent(1)[0];
  assert.equal(entry?.message, "runtime_lifecycle_repository.operation_failed");
  assert.equal(entry?.level, "warn");
  assert.equal(entry?.data?.operation, "getApproval");
  assert.equal(entry?.data?.ok, false);
});
