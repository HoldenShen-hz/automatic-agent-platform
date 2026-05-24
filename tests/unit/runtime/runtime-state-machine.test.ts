import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../src/platform/contracts/errors.js";
import { createPlatformFactEvent } from "../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../src/platform/five-plane-execution/runtime-state-machine.js";

test("RuntimeStateMachine can be instantiated and emit fact events", () => {
  const persisted: string[] = [];
  const machine = new RuntimeStateMachine({
    persistEvent: (event) => {
      persisted.push(event.eventType);
    },
  });

  machine.emitFactEvent(createPlatformFactEvent({
    eventId: "evt-1",
    eventType: "platform.test.emitted",
    aggregateType: "HarnessRun",
    aggregateId: "aggregate-1",
    aggregateSeq: 1,
    tenantId: "tenant-1",
    runId: "run-1",
    traceId: "trace-1",
    occurredAt: new Date().toISOString(),
    payload: {},
  }));

  assert.deepEqual(persisted, ["platform.test.emitted"]);
});

test("RuntimeStateMachine validates and applies a harness-run created -> admitted transition", () => {
  const persisted: string[] = [];
  const machine = new RuntimeStateMachine({
    persistEvent: (event) => {
      persisted.push(event.eventType);
    },
  });
  const aggregate = machine.createHarnessRunAggregate("harness-run-1");
  const command = machine.buildTransitionCommand(aggregate, "admitted", "created", {
    commandId: "cmd-1",
    entityType: "HarnessRun",
    entityId: aggregate.harnessRunId,
    principal: "principal-1",
    aggregateType: "HarnessRun",
    traceId: "trace-1",
    tenantId: aggregate.tenantId,
    reasonCode: "runtime.admit",
    emittedBy: "test",
    runVersionLockId: aggregate.versionLockId,
    fencingToken: aggregate.fencingToken,
    auditRef: "audit-1",
    ...(aggregate.leaseId == null ? {} : { leaseId: aggregate.leaseId }),
  });

  const result = machine.transition(command);

  assert.equal(machine.validateTransition(aggregate, "admitted", "created"), true);
  assert.equal(result.aggregate.status, "admitted");
  assert.equal(persisted[0]?.startsWith("platform.harness_run.status_changed"), true);
});

test("RuntimeStateMachine rejects noop and invalid harness-run transitions", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => undefined });
  const aggregate = machine.createHarnessRunAggregate("harness-run-2");

  assert.throws(
    () =>
      machine.transition(machine.buildTransitionCommand(aggregate, "created", "created", {
        commandId: "cmd-noop",
        entityType: "HarnessRun",
        entityId: aggregate.harnessRunId,
        principal: "principal-1",
        aggregateType: "HarnessRun",
        traceId: "trace-1",
        tenantId: aggregate.tenantId,
        reasonCode: "runtime.noop",
        emittedBy: "test",
        auditRef: "audit-noop",
      })),
    WorkflowStateError,
  );

  assert.equal(machine.validateTransition(aggregate, "running", "created"), false);
});

test("RuntimeStateMachine applies a node-run created -> ready transition", () => {
  const machine = new RuntimeStateMachine({ persistEvent: () => undefined });
  const aggregate = {
    ...machine.createNodeRunAggregate("node-run-1", "harness-run-1"),
    leaseId: "lease-1",
  };

  const result = machine.executeTransition(aggregate, "ready", {
    commandId: "cmd-node",
    entityType: "NodeRun",
    entityId: aggregate.nodeRunId,
    principal: "principal-1",
    aggregateType: "NodeRun",
    traceId: "trace-node",
    tenantId: "tenant-1",
    reasonCode: "runtime.node_ready",
    emittedBy: "test",
    expectedSeq: aggregate.currentSeq,
    leaseId: aggregate.leaseId,
    fencingToken: aggregate.fencingToken,
    auditRef: "audit-node",
  });

  assert.equal(result.aggregate.status, "ready");
  assert.equal(result.event.aggregateType, "NodeRun");
});
