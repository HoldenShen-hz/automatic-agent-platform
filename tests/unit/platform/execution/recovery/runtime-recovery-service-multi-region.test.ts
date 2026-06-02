import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeRecoveryService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";
import type { RuntimeRecoveryRecord } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function createStore(record: RuntimeRecoveryRecord) {
  return {
    task: { getTask: () => null },
    operations: {
      listRecoverableExecutingRuns: () => [record],
      listStaleRuns: () => [],
      buildRuntimeRecoveryView: () => [],
    },
    listBlockedRunsAwaitingApproval: () => [],
    event: { listEventsForTask: () => [] },
    artifact: { listArtifactsByTask: () => [] },
    approval: { listApprovalsByTask: () => [] },
    dispatch: { listDeadLettersByTask: () => [], getExecution: () => null },
  } as any;
}

test("RuntimeRecoveryService only escalates cross-region retry after attempt threshold is reached [runtime-recovery-service-multi-region]", () => {
  const record: RuntimeRecoveryRecord = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "general-ops",
    taskStatus: "running",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2026-05-26T00:00:00.000Z",
    lastHeartbeatAt: "2026-05-26T00:00:00.000Z",
    pendingApprovalId: null,
    latestPrecheck: null,
  };
  const service = new RuntimeRecoveryService(
    createStore(record),
    undefined,
    undefined,
    {
      workerRegionResolver: () => "us-east",
      primaryRegionResolver: () => "us-west",
    },
  );

  const [candidate] = service.listRecoverableExecutingRuns();
  assert.equal(candidate?.suggestedAction, "resume_same_worker");
});

test("RuntimeRecoveryService retries on a new ticket after cross-region mismatch survives multiple attempts [runtime-recovery-service-multi-region]", () => {
  const record: RuntimeRecoveryRecord = {
    executionId: "exec-2",
    taskId: "task-2",
    divisionId: "general-ops",
    taskStatus: "running",
    status: "executing",
    attempt: 2,
    traceId: "trace-2",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2026-05-26T00:00:00.000Z",
    lastHeartbeatAt: "2026-05-26T00:00:00.000Z",
    pendingApprovalId: null,
    latestPrecheck: null,
  };
  const service = new RuntimeRecoveryService(
    createStore(record),
    undefined,
    undefined,
    {
      workerRegionResolver: () => "us-east",
      primaryRegionResolver: () => "us-west",
    },
  );

  const [candidate] = service.listRecoverableExecutingRuns();
  assert.equal(candidate?.suggestedAction, "retry_new_ticket");
});
