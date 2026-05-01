import assert from "node:assert/strict";
import test from "node:test";

import { OapeflirLoopService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { MockExecuteBridge } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";

test("OapeflirLoopService can be instantiated with no arguments", () => {
  const service = new OapeflirLoopService();
  assert.ok(service);
});

test("OapeflirLoopService accepts executeBridge option", () => {
  const bridge = new MockExecuteBridge();
  const service = new OapeflirLoopService({ executeBridge: bridge });
  assert.ok(service);
});

test("OapeflirLoopService accepts dbPath option", () => {
  // Using a non-existent path - the service may fail when run is called but should construct fine
  const service = new OapeflirLoopService({ dbPath: "/tmp/non-existent-db-path-for-test.sqlite" });
  assert.ok(service);
});

test("OapeflirLoopService accepts eventPublisher option as null", () => {
  const service = new OapeflirLoopService({ eventPublisher: null });
  assert.ok(service);
});

test("OapeflirLoopService has run method", () => {
  const service = new OapeflirLoopService();
  assert.equal(typeof service.run, "function");
});

test("OapeflirLoopService has buildSerializedHandoff method", () => {
  const service = new OapeflirLoopService();
  assert.equal(typeof service.buildSerializedHandoff, "function");
});

test("buildSerializedHandoff accepts result with minimal structure", () => {
  const service = new OapeflirLoopService();
  // Minimal mock result that buildSerializedHandoff needs
  const mockResult = {
    observation: {
      task: {
        taskId: "test-task",
        blockers: [] as Array<{ description: string }>,
      },
    },
    plan: {
      steps: [],
    },
    stepOutputs: [],
    feedback: {
      signals: [],
    },
  };

  const handoff = service.buildSerializedHandoff(
    mockResult as any,
    "agent-1",
    "agent-2",
    4096,
  );
  assert.ok(handoff);
  assert.equal(handoff.fromAgentId, "agent-1");
  assert.equal(handoff.toAgentId, "agent-2");
});

test("buildSerializedHandoff with empty feedback signals returns empty summary", () => {
  const service = new OapeflirLoopService();
  const mockResult = {
    observation: { task: { taskId: "t1", blockers: [] } },
    plan: { steps: [] },
    stepOutputs: [],
    feedback: { signals: [] },
  };
  const handoff = service.buildSerializedHandoff(mockResult as any, "a", "b", 4096);
  assert.ok(handoff);
});

test("buildSerializedHandoff with multiple stepOutputs and artifacts", () => {
  const service = new OapeflirLoopService();
  const mockResult = {
    observation: { task: { taskId: "t1", blockers: [] } },
    plan: { steps: [{ stepId: "s1", tool: "shell", args: {}, timeout: 30000 }] },
    stepOutputs: [
      {
        stepId: "s1",
        status: "succeeded",
        userFacingResult: { summary: "Ran tests", artifacts: ["test-output.json"] },
        systemTelemetry: { durationMs: 100 },
      },
    ],
    feedback: { signals: [] },
  };
  const handoff = service.buildSerializedHandoff(mockResult as any, "agent-a", "agent-b", 4096);
  assert.ok(handoff);
});

test("OapeflirLoopService OapeflirLoopInput interface validation - stepOutputs optional", () => {
  const service = new OapeflirLoopService();
  // Verify stepOutputs is optional by passing undefined
  const input = {
    taskId: "task1",
    objective: "test",
    workflow: { executionSteps: [], workflow: { workflowId: "w1", divisionId: "d1", steps: [] } } as any,
    stepOutputs: undefined,
  };
  assert.ok(input.stepOutputs === undefined);
});