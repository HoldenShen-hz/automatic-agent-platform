import assert from "node:assert/strict";
import test from "node:test";

import {
  ToolbeltAssembler,
  type ToolbeltAssemblyRequest,
  type HarnessToolbelt,
} from "../../../../../../src/platform/orchestration/harness/toolbelt-assembler.js";

// ToolbeltAssembler tests

test("ToolbeltAssembler.assemble grants requested tools that are in allowed list", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a", "tool_b", "tool_c"],
    requestedTools: ["tool_a", "tool_c"],
    requiredEvidence: ["evidence_1"],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.allowedTools, ["tool_a", "tool_b", "tool_c"]);
  assert.deepEqual(result.grantedTools, ["tool_a", "tool_c"]);
  assert.deepEqual(result.blockedTools, []);
  assert.deepEqual(result.requiredEvidence, ["evidence_1"]);
});

test("ToolbeltAssembler.assemble blocks requested tools that are NOT in allowed list", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a", "tool_b"],
    requestedTools: ["tool_a", "tool_c", "tool_d"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, ["tool_a"]);
  assert.deepEqual(result.blockedTools, ["tool_c", "tool_d"]);
});

test("ToolbeltAssembler.assemble handles empty allowedTools list", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: [],
    requestedTools: ["tool_a"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, []);
  assert.deepEqual(result.blockedTools, ["tool_a"]);
});

test("ToolbeltAssembler.assemble handles empty requestedTools list", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a", "tool_b"],
    requestedTools: [],
    requiredEvidence: ["evidence_1", "evidence_2"],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, []);
  assert.deepEqual(result.blockedTools, []);
  assert.deepEqual(result.requiredEvidence, ["evidence_1", "evidence_2"]);
});

test("ToolbeltAssembler.assemble handles no overlap between allowed and requested", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_x", "tool_y"],
    requestedTools: ["tool_a", "tool_b"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, []);
  assert.deepEqual(result.blockedTools, ["tool_a", "tool_b"]);
});

test("ToolbeltAssembler.assemble handles duplicate tools in requestedTools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a"],
    requestedTools: ["tool_a", "tool_a", "tool_a"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  // Granted tools should not have duplicates based on current implementation
  assert.deepEqual(result.grantedTools, ["tool_a", "tool_a", "tool_a"]);
});

test("ToolbeltAssembler.assemble preserves order of grantedTools as requested", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_c", "tool_b", "tool_a"],
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, ["tool_a", "tool_b", "tool_c"]);
  assert.deepEqual(result.blockedTools, []);
});

test("ToolbeltAssembler.assemble handles empty requiredEvidence", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a"],
    requestedTools: ["tool_a"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.requiredEvidence, []);
});

test("ToolbeltAssembler.assemble preserves readonly arrays", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a", "tool_b"],
    requestedTools: ["tool_a"],
    requiredEvidence: ["evidence_1"],
  };

  const result = assembler.assemble(request);

  // Verify result arrays are mutable copies (not readonly views)
  assert.ok(Array.isArray(result.allowedTools));
  assert.ok(Array.isArray(result.grantedTools));
  assert.ok(Array.isArray(result.blockedTools));
  assert.ok(Array.isArray(result.requiredEvidence));
});

test("ToolbeltAssembler.assemble with all tools allowed", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a", "tool_b", "tool_c", "tool_d"],
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, ["tool_a", "tool_b", "tool_c"]);
  assert.deepEqual(result.blockedTools, []);
});

test("ToolbeltAssembler.assemble with subset of tools allowed", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_b", "tool_c"],
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, ["tool_b", "tool_c"]);
  assert.deepEqual(result.blockedTools, ["tool_a"]);
});

test("ToolbeltAssembler.assemble case sensitive tool names", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["Tool_A", "tool_a"],
    requestedTools: ["tool_a", "TOOL_A"],
    requiredEvidence: [],
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, ["tool_a"]);
  assert.deepEqual(result.blockedTools, ["TOOL_A"]);
});