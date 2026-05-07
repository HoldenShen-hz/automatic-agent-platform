import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";

test("ExecutionDispatchService deterministically rotates equal-score workers by ticket seed", () => {
  const service = Object.create(ExecutionDispatchService.prototype) as ExecutionDispatchService;
  const eligibleWorkers = [
    {
      workerId: "worker-a",
      availableSlots: 1,
      activeLeaseCount: 0,
      runningExecutionIds: [],
      toolBacklogCount: 0,
    },
    {
      workerId: "worker-b",
      availableSlots: 1,
      activeLeaseCount: 0,
      runningExecutionIds: [],
      toolBacklogCount: 0,
    },
  ];
  const evaluations = eligibleWorkers.map((worker) => ({
    workerId: worker.workerId,
    accepted: true,
    dispatchScore: 10,
    availableSlots: 1,
    activeLeaseCount: 0,
    runningExecutionCount: 0,
    toolBacklogCount: 0,
  }));

  const firstChoice = (service as any).selectDeterministicWorker(
    { id: "ticket-1", executionId: "exec-1", taskId: "task-1" },
    eligibleWorkers,
    evaluations,
  );
  const secondChoice = (service as any).selectDeterministicWorker(
    { id: "ticket-2", executionId: "exec-2", taskId: "task-2" },
    eligibleWorkers,
    evaluations,
  );
  const repeatedFirstChoice = (service as any).selectDeterministicWorker(
    { id: "ticket-1", executionId: "exec-1", taskId: "task-1" },
    eligibleWorkers,
    evaluations,
  );

  assert.equal(firstChoice.workerId, repeatedFirstChoice.workerId);
  assert.notEqual(firstChoice.workerId, secondChoice.workerId);
});
