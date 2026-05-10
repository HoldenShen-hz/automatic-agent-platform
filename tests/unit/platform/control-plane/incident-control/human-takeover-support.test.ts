import assert from "node:assert/strict";
import test from "node:test";

import {
  workflowTerminalForTask,
  sessionTerminalForTask,
  executionTerminalForTask,
  normalizeInputJson,
  normalizeJson,
  parseOutputs,
  resolveManualStepOutputSummary,
  serializeSnapshot,
  throwTakeoverStorageError,
  throwTakeoverWorkflowError,
} from "../../../../../src/platform/control-plane/incident-control/human-takeover-support.js";

test("workflowTerminalForTask maps done to completed", () => {
  assert.equal(workflowTerminalForTask("done"), "completed");
});

test("workflowTerminalForTask passes through failed and cancelled", () => {
  assert.equal(workflowTerminalForTask("failed"), "failed");
  assert.equal(workflowTerminalForTask("cancelled"), "cancelled");
});

test("sessionTerminalForTask maps done to completed", () => {
  assert.equal(sessionTerminalForTask("done"), "completed");
});

test("sessionTerminalForTask passes through failed and cancelled", () => {
  assert.equal(sessionTerminalForTask("failed"), "failed");
  assert.equal(sessionTerminalForTask("cancelled"), "cancelled");
});

test("executionTerminalForTask maps done to succeeded", () => {
  assert.equal(executionTerminalForTask("done"), "succeeded");
});

test("executionTerminalForTask passes through failed and cancelled", () => {
  assert.equal(executionTerminalForTask("failed"), "failed");
  assert.equal(executionTerminalForTask("cancelled"), "cancelled");
});

test("normalizeInputJson parses and re-serializes valid JSON", () => {
  const input = '{"key": "value", "num": 123}';
  const result = normalizeInputJson(input);
  assert.ok(result.includes('"key"'));
  assert.ok(result.includes('"value"'));
});

test("normalizeInputJson returns trimmed input for invalid JSON", () => {
  const result = normalizeInputJson("not json  ");
  assert.equal(result, "not json");
});

test("normalizeInputJson handles empty string", () => {
  const result = normalizeInputJson("");
  assert.equal(result, "");
});

test("parseOutputs parses valid JSON", () => {
  const result = parseOutputs('{"key": "value"}');
  assert.deepEqual(result, { key: "value" });
});

test("parseOutputs handles nested objects", () => {
  const result = parseOutputs('{"outer": {"inner": "value"}}');
  assert.deepEqual(result, { outer: { inner: "value" } });
});

test("parseOutputs returns empty object for invalid JSON", () => {
  const result = parseOutputs("not json");
  assert.deepEqual(result, {});
});

test("parseOutputs handles empty string", () => {
  const result = parseOutputs("");
  assert.deepEqual(result, {});
});

test("resolveManualStepOutputSummary returns summary field when present", () => {
  const output = { summary: "Custom summary", data: "other" };
  assert.equal(resolveManualStepOutputSummary("step_1", output), "Custom summary");
});

test("resolveManualStepOutputSummary returns default for missing summary", () => {
  const output = { data: "other" };
  assert.equal(resolveManualStepOutputSummary("step_1", output), "Operator supplied output for step_1");
});

test("resolveManualStepOutputSummary returns default for null output", () => {
  assert.equal(resolveManualStepOutputSummary("step_2", null), "Operator supplied output for step_2");
});

test("resolveManualStepOutputSummary returns default for non-object output", () => {
  assert.equal(resolveManualStepOutputSummary("step_3", "string output"), "Operator supplied output for step_3");
  assert.equal(resolveManualStepOutputSummary("step_3", 123), "Operator supplied output for step_3");
});

test("resolveManualStepOutputSummary returns default for array output", () => {
  assert.equal(resolveManualStepOutputSummary("step_4", [1, 2, 3]), "Operator supplied output for step_4");
});

test("resolveManualStepOutputSummary handles empty summary string", () => {
  const output = { summary: "", data: "other" };
  assert.equal(resolveManualStepOutputSummary("step_1", output), "Operator supplied output for step_1");
});

test("normalizeJson parses and re-serializes valid JSON", () => {
  const input = '{"key": "value", "num": 123}';
  const result = normalizeJson(input, "test.error");
  assert.ok(result.includes('"key"'));
  assert.ok(result.includes('"value"'));
});

test("normalizeJson handles nested objects", () => {
  const result = normalizeJson('{"outer": {"inner": "value"}}', "test.error");
  assert.ok(result.includes('"outer"'));
});

test("normalizeJson throws ValidationError for invalid JSON", () => {
  assert.throws(
    () => normalizeJson("not json", "test.invalid_json"),
    (e: any) => e.code === "test.invalid_json"
  );
});

test("normalizeJson throws with provided error code", () => {
  assert.throws(
    () => normalizeJson("invalid", "takeover.invalid_input"),
    (e: any) => e.code === "takeover.invalid_input"
  );
});

test("throwTakeoverStorageError throws StorageError with correct code", () => {
  assert.throws(
    () => throwTakeoverStorageError("takeover.storage_error", { taskId: "task_123" }),
    (e: any) => {
      return e.code === "takeover.storage_error" && e.statusCode === 404;
    }
  );
});

test("throwTakeoverStorageError includes details", () => {
  assert.throws(
    () => throwTakeoverStorageError("takeover.error", { key: "value" }),
    (e: any) => {
      assert.deepEqual(e.details, { key: "value" });
      return true;
    },
  );
});

test("throwTakeoverWorkflowError throws WorkflowStateError with correct code", () => {
  assert.throws(
    () => throwTakeoverWorkflowError("takeover.workflow_error", { workflowId: "wf_123" }),
    (e: any) => {
      return e.code === "takeover.workflow_error";
    }
  );
});

test("throwTakeoverWorkflowError includes details", () => {
  assert.throws(
    () => throwTakeoverWorkflowError("takeover.error", { stepId: "step_1" }),
    (e: any) => {
      assert.deepEqual(e.details, { stepId: "step_1" });
      return true;
    },
  );
});

test("serializeSnapshot formats snapshot correctly", () => {
  const snapshot = {
    task: { id: "task_1", title: "Test Task" },
    workflow: { workflowId: "wf_1", status: "running" },
    execution: { id: "exec_1", status: "active" },
    session: { id: "sess_1", status: "open" },
    stepOutputs: [
      { nodeRunId: "nrun_1", stepId: "step_1", status: "completed" },
      { nodeRunId: "nrun_2", stepId: "step_2", status: "failed" },
    ],
    events: [
      { eventType: "task:started" },
      { eventType: "task:completed" },
    ],
  } as any;

  const result = serializeSnapshot(snapshot);

  assert.equal(result.task, snapshot.task);
  assert.equal(result.workflow, snapshot.workflow);
  assert.equal(result.execution, snapshot.execution);
  assert.equal(result.session, snapshot.session);
  assert.deepEqual(result.stepOutputs, [
    { nodeRunId: "nrun_1", stepId: "step_1", status: "completed" },
    { nodeRunId: "nrun_2", stepId: "step_2", status: "failed" },
  ]);
  assert.deepEqual(result.recentEventTypes, ["task:started", "task:completed"]);
});

test("serializeSnapshot handles empty arrays", () => {
  const snapshot = {
    task: { id: "task_1" },
    workflow: null,
    execution: null,
    session: null,
    stepOutputs: [],
    events: [],
  } as any;

  const result = serializeSnapshot(snapshot);

  assert.deepEqual(result.stepOutputs, []);
  assert.deepEqual(result.recentEventTypes, []);
});
