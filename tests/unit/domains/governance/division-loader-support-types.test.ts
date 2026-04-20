import assert from "node:assert/strict";
import test from "node:test";

import type {
  ParsedLine,
  RawDivisionRoleConfig,
  RawDivisionConfig,
  RawWorkflowStepConfig,
  RawWorkflowConfig,
} from "../../../../src/domains/governance/division-loader-support.js";

test("ParsedLine structure is correct", () => {
  const line: ParsedLine = {
    indent: 2,
    text: "some text content",
    lineNumber: 10,
  };
  assert.equal(line.indent, 2);
  assert.equal(line.text, "some text content");
  assert.equal(line.lineNumber, 10);
});

test("ParsedLine allows zero indent", () => {
  const line: ParsedLine = {
    indent: 0,
    text: "no indent",
    lineNumber: 1,
  };
  assert.equal(line.indent, 0);
});

test("RawDivisionRoleConfig structure is correct", () => {
  const config: RawDivisionRoleConfig = {
    id: "executor",
    name: "Task Executor",
    prompt: "You are a task executor",
    model: "claude-3-5-sonnet",
    tools: ["read", "edit"],
    max_instances: 5,
  };
  assert.equal(config.id, "executor");
  assert.equal(config.name, "Task Executor");
  assert.equal(config.prompt, "You are a task executor");
});

test("RawDivisionRoleConfig allows minimal definition", () => {
  const config: RawDivisionRoleConfig = {
    id: "minimal_role",
    prompt: "Minimal prompt",
  };
  assert.equal(config.id, "minimal_role");
  assert.equal(config.prompt, "Minimal prompt");
  assert.equal(config.name, undefined);
  assert.equal(config.model, undefined);
});

test("RawDivisionConfig structure is correct", () => {
  const config: RawDivisionConfig = {
    id: "general",
    name: "General Division",
    description: "Default division for general tasks",
    priority: "normal",
    default_workflow: "default wf",
    roles: {},
  };
  assert.equal(config.id, "general");
  assert.equal(config.name, "General Division");
  assert.equal(config.default_workflow, "default wf");
});

test("RawDivisionConfig allows minimal definition", () => {
  const config: RawDivisionConfig = {
    id: "minimal",
    name: "Minimal Division",
    default_workflow: "basic",
  };
  assert.equal(config.id, "minimal");
  assert.equal(config.default_workflow, "basic");
  assert.equal(config.version, undefined);
});

test("RawWorkflowStepConfig structure is correct", () => {
  const config: RawWorkflowStepConfig = {
    step_id: "step_1",
    division_id: "general",
    role_id: "executor",
    input_keys: ["task_id"],
    output_key: "result",
    output_schema: {},
    timeout_ms: 30000,
    max_attempts: 3,
    depends_on: [],
  };
  assert.equal(config.step_id, "step_1");
  assert.equal(config.role_id, "executor");
  assert.equal(config.output_key, "result");
  assert.equal(config.timeout_ms, 30000);
});

test("RawWorkflowStepConfig allows minimal definition", () => {
  const config: RawWorkflowStepConfig = {
    step_id: "step_minimal",
    role_id: "executor",
    output_key: "out",
    timeout_ms: 60000,
    max_attempts: 1,
  };
  assert.equal(config.step_id, "step_minimal");
  assert.equal(config.output_key, "out");
});

test("RawWorkflowConfig structure is correct", () => {
  const config: RawWorkflowConfig = {
    id: "workflow_1",
    division_id: "general",
    steps: [],
  };
  assert.equal(config.id, "workflow_1");
  assert.equal(config.division_id, "general");
});

test("RawWorkflowConfig allows complex steps", () => {
  const config: RawWorkflowConfig = {
    id: "complex_wf",
    division_id: "general",
    steps: [
      { step_id: "step1", role_id: "executor", output_key: "out1", timeout_ms: 10000, max_attempts: 1 },
      { step_id: "step2", role_id: "reviewer", output_key: "out2", timeout_ms: 20000, max_attempts: 2 },
    ] as unknown,
  };
  assert.equal((config.steps as unknown as Array<unknown>).length, 2);
});
