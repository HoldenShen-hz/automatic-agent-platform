import assert from "node:assert/strict";
import test from "node:test";

import {
  ObserverService,
  type ObservationBundle,
} from "../../../../../src/platform/five-plane-orchestration/observer/observer-service.js";

test("ObserverService.observe clones inputs, emits monotonic timestamps, and signs bundles", () => {
  const service = new ObserverService({
    hmacKey: "observer-test-key",
    now: () => 1_700_000_000_000,
  });
  const taskInputs = { nested: { attempt: 1 } };
  const environmentState = { mode: "prod" };

  const bundle = service.observe({
    taskId: "task-1",
    taskGoal: "Ship release",
    taskInputs,
    environmentState,
    relevantHistory: ["hist-1"],
    knowledgeRefs: ["kb-1"],
    parentNodeRunId: "node-1",
    subgraphNodeIds: ["sub-1", "sub-2"],
  });

  taskInputs.nested.attempt = 99;
  environmentState.mode = "tampered";

  assert.deepEqual(
    bundle.signals.map((signal) => signal.timestamp),
    [
      1_700_000_000_000,
      1_700_000_000_001,
      1_700_000_000_002,
      1_700_000_000_003,
      1_700_000_000_004,
      1_700_000_000_005,
    ],
  );
  assert.equal(bundle.contextSnapshot.capturedAt, 1_700_000_000_006);
  assert.equal(bundle.assembledAt, 1_700_000_000_007);
  assert.equal(bundle.contextSnapshot.taskInputs.nested.attempt, 1);
  assert.equal(bundle.contextSnapshot.environmentState.mode, "prod");
  assert.equal(service.verifyBundle(bundle).valid, true);
  assert.equal(Object.isFrozen(bundle), true);
  assert.equal(Object.isFrozen(bundle.contextSnapshot), true);
  assert.equal(Object.isFrozen(bundle.signals), true);
});

test("ObserverService.verifyBundle rejects tampered bundles", () => {
  const service = new ObserverService({
    hmacKey: "observer-test-key",
    now: () => 2_000,
  });
  const bundle = service.observe({
    taskId: "task-2",
    taskGoal: "Audit change",
    taskInputs: { approved: true },
  });

  const tampered = {
    ...bundle,
    contextSnapshot: {
      ...bundle.contextSnapshot,
      taskGoal: "Tampered goal",
    },
  } satisfies ObservationBundle;

  const verification = service.verifyBundle(tampered);
  assert.equal(verification.valid, false);
  assert.equal(verification.reasonCode, "integrity.checksum_mismatch");
});
