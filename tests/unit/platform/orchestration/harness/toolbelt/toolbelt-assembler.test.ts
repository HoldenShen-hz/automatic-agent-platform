import assert from "node:assert/strict";
import test from "node:test";

import { ToolbeltAssembler, type ToolbeltAssemblyRequest } from "../../../../../../src/platform/five-plane-orchestration/harness/toolbelt-assembler.js";

test("ToolbeltAssembler.assemble grants allowed tools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["toolA", "toolB", "toolC"],
    requestedTools: ["toolA", "toolC"],
    requiredEvidence: ["evidence1"],
  };

  const toolbelt = assembler.assemble(request);

  assert.deepEqual(toolbelt.grantedTools, ["toolA", "toolC"]);
  assert.deepEqual(toolbelt.blockedTools, []);
  assert.deepEqual(toolbelt.allowedTools, ["toolA", "toolB", "toolC"]);
  assert.deepEqual(toolbelt.requiredEvidence, ["evidence1"]);
});

test("ToolbeltAssembler.assemble blocks disallowed tools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["toolA"],
    requestedTools: ["toolA", "toolB"],
    requiredEvidence: [],
  };

  const toolbelt = assembler.assemble(request);

  assert.deepEqual(toolbelt.grantedTools, ["toolA"]);
  assert.deepEqual(toolbelt.blockedTools, ["toolB"]);
});

test("ToolbeltAssembler.assemble handles empty requestedTools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["toolA", "toolB"],
    requestedTools: [],
    requiredEvidence: [],
  };

  const toolbelt = assembler.assemble(request);

  assert.deepEqual(toolbelt.grantedTools, []);
  assert.deepEqual(toolbelt.blockedTools, []);
});

test("ToolbeltAssembler.assemble handles no allowedTools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: [],
    requestedTools: ["toolA"],
    requiredEvidence: ["ev1"],
  };

  const toolbelt = assembler.assemble(request);

  assert.deepEqual(toolbelt.grantedTools, []);
  assert.deepEqual(toolbelt.blockedTools, ["toolA"]);
});

test("ToolbeltAssembler.assemble copies arrays to prevent mutation", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["toolA"],
    requestedTools: ["toolA"],
    requiredEvidence: ["ev1"],
  };

  const toolbelt = assembler.assemble(request);

  assert.ok(request.allowedTools !== toolbelt.allowedTools);
  assert.ok(request.requestedTools !== toolbelt.grantedTools);
});

test("ToolbeltAssembler.assemble with multiple blocked tools", () => {
  const assembler = new ToolbeltAssembler();
  const request: ToolbeltAssemblyRequest = {
    allowedTools: ["toolA"],
    requestedTools: ["toolA", "toolB", "toolC", "toolD"],
    requiredEvidence: [],
  };

  const toolbelt = assembler.assemble(request);

  assert.deepEqual(toolbelt.grantedTools, ["toolA"]);
  assert.deepEqual(toolbelt.blockedTools, ["toolB", "toolC", "toolD"]);
});