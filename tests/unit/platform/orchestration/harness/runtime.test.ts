import test from "node:test";
import assert from "node:assert/strict";
import { ToolbeltAssembler } from "../../../../../src/platform/orchestration/harness/index.js";

test("ToolbeltAssembler is exported and can be instantiated", () => {
  const assembler = new ToolbeltAssembler();
  assert.ok(assembler !== undefined);
  assert.equal(typeof assembler.assemble, "function");
});

test("ToolbeltAssembler.assemble grants allowed tools", () => {
  const assembler = new ToolbeltAssembler();
  const toolbelt = assembler.assemble({
    allowedTools: ["tool-a", "tool-b", "tool-c"],
    requestedTools: ["tool-a", "tool-c"],
    requiredEvidence: ["evidence-1"],
  });

  assert.deepEqual(toolbelt.grantedTools, ["tool-a", "tool-c"]);
  assert.deepEqual(toolbelt.blockedTools, []);
  assert.deepEqual(toolbelt.allowedTools, ["tool-a", "tool-b", "tool-c"]);
  assert.deepEqual(toolbelt.requiredEvidence, ["evidence-1"]);
});

test("ToolbeltAssembler.assemble blocks tools not in allowed list", () => {
  const assembler = new ToolbeltAssembler();
  const toolbelt = assembler.assemble({
    allowedTools: ["tool-a", "tool-b"],
    requestedTools: ["tool-a", "tool-x", "tool-y"],
    requiredEvidence: [],
  });

  assert.deepEqual(toolbelt.grantedTools, ["tool-a"]);
  assert.deepEqual(toolbelt.blockedTools, ["tool-x", "tool-y"]);
});

test("ToolbeltAssembler.assemble handles empty requested tools", () => {
  const assembler = new ToolbeltAssembler();
  const toolbelt = assembler.assemble({
    allowedTools: ["tool-a"],
    requestedTools: [],
    requiredEvidence: [],
  });

  assert.deepEqual(toolbelt.grantedTools, []);
  assert.deepEqual(toolbelt.blockedTools, []);
});

test("ToolbeltAssembler.assemble creates defensive copies", () => {
  const assembler = new ToolbeltAssembler();
  const allowedTools = ["tool-a"];
  const requestedTools = ["tool-a"];

  const toolbelt = assembler.assemble({
    allowedTools,
    requestedTools,
    requiredEvidence: [],
  });

  // Modifying input arrays should not affect toolbelt
  allowedTools.push("tool-b");
  requestedTools.push("tool-c");

  assert.equal(toolbelt.allowedTools.length, 1);
  assert.equal(toolbelt.grantedTools.length, 1);
});
