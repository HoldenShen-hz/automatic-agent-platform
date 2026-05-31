import assert from "node:assert/strict";
import test from "node:test";

import { HumanTakeoverServiceAsync as ScaleHumanTakeoverServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/human-takeover-service-async.js";
import { HumanTakeoverServiceAsync as PlatformHumanTakeoverServiceAsync } from "../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service-async.js";

test("scale human-takeover async extends the platform service [human-takeover-service-async]", () => {
  assert.equal(Object.getPrototypeOf(ScaleHumanTakeoverServiceAsync.prototype), PlatformHumanTakeoverServiceAsync.prototype);
  assert.equal(typeof ScaleHumanTakeoverServiceAsync.prototype.openSession, "function");
  assert.equal(typeof ScaleHumanTakeoverServiceAsync.prototype.completeTask, "function");
  assert.equal(typeof ScaleHumanTakeoverServiceAsync.prototype.getMetrics, "function");
});

test("scale human-takeover async initializes zeroed metrics [human-takeover-service-async]", () => {
  const service = new ScaleHumanTakeoverServiceAsync({} as never, {} as never);
  assert.deepEqual(service.getMetrics(), {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    operationsByType: {
      openSession: 0,
      modifyInput: 0,
      switchWorker: 0,
      retryExecution: 0,
      setCurrentStep: 0,
      writeStepOutput: 0,
      skipCurrentStep: 0,
      completeTask: 0,
    },
  });
  service.dispose();
});
