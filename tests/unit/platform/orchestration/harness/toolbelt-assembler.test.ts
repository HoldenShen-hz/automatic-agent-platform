import test from "node:test";
import assert from "node:assert/strict";
import { ToolbeltAssembler, type ToolbeltAssemblyRequest } from "../../../../../src/platform/five-plane-orchestration/harness/toolbelt-assembler.js";

test("ToolbeltAssembler.grantedTools contains requested tools that are in allowed list", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: ["tool_a", "tool_b", "tool_c"],
    requestedTools: ["tool_a", "tool_b"],
    requiredEvidence: ["execution_log"],
  });

  assert.deepEqual(result.grantedTools, ["tool_a", "tool_b"]);
  assert.deepEqual(result.blockedTools, []);
});

test("ToolbeltAssembler.blocks tools not in allowed list", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: ["tool_a"],
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    requiredEvidence: [],
  });

  assert.deepEqual(result.grantedTools, ["tool_a"]);
  assert.deepEqual(result.blockedTools, ["tool_b", "tool_c"]);
});

test("ToolbeltAssembler allows all tools when none requested", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: ["tool_a", "tool_b"],
    requestedTools: [],
    requiredEvidence: [],
  });

  assert.deepEqual(result.grantedTools, []);
  assert.deepEqual(result.blockedTools, []);
});

test("ToolbeltAssembler blocks all tools when none allowed", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: [],
    requestedTools: ["tool_a", "tool_b"],
    requiredEvidence: [],
  });

  assert.deepEqual(result.grantedTools, []);
  assert.deepEqual(result.blockedTools, ["tool_a", "tool_b"]);
});

test("ToolbeltAssembler preserves allowedTools and requiredEvidence", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: ["x", "y", "z"],
    requestedTools: ["x"],
    requiredEvidence: ["evidence_1", "evidence_2"],
  });

  assert.deepEqual(result.allowedTools, ["x", "y", "z"]);
  assert.deepEqual(result.requiredEvidence, ["evidence_1", "evidence_2"]);
});

test("ToolbeltAssembler handles duplicate requested tools", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: ["tool_a"],
    requestedTools: ["tool_a", "tool_a", "tool_a"],
    requiredEvidence: [],
  });

  assert.deepEqual(result.grantedTools, ["tool_a", "tool_a", "tool_a"]);
});

test("ToolbeltAssembler case-sensitive tool matching", () => {
  const assembler = new ToolbeltAssembler();
  const result = assembler.assemble({
    allowedTools: ["Tool_A", "tool_a"],
    requestedTools: ["tool_a"],
    requiredEvidence: [],
  });

  // tool_a matches tool_a but not Tool_A
  assert.deepEqual(result.grantedTools, ["tool_a"]);
  assert.deepEqual(result.blockedTools, []);
});

test("ToolbeltAssembler attaches per-tool sandbox bindings for granted tools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["tool_a", "tool_b"],
    requestedTools: ["tool_a", "tool_b", "tool_c"],
    requiredEvidence: [],
    sandboxRequirement: {
      sandboxMode: "network_isolated",
      timeoutMs: 45_000,
      allowedHosts: ["api.example.com"],
    },
  };

  const result = assembler.assemble(request);

  assert.deepEqual(result.grantedTools, ["tool_a", "tool_b"]);
  assert.equal(result.sandboxLayer.defaultLayer, "network_isolated");
  assert.equal(result.sandboxLayer.bindings.length, 2);
  assert.deepEqual(
    result.sandboxLayer.bindings.map((binding) => binding.toolName),
    ["tool_a", "tool_b"],
  );
  assert.deepEqual(result.sandboxLayer.bindings[0]?.allowedHosts, ["api.example.com"]);
});
