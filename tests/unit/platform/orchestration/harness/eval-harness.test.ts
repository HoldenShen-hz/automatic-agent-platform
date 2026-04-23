import test from "node:test";
import assert from "node:assert/strict";
import { ContextAssembler } from "../../../../../src/platform/orchestration/harness/context-assembler.js";
import type { HarnessContext, HarnessContextSourceSet } from "../../../../../src/platform/orchestration/harness/context-assembler.js";

test("ContextAssembler is exported and can be instantiated", () => {
  const assembler = new ContextAssembler();
  assert.ok(assembler !== undefined);
  assert.equal(typeof assembler.assemble, "function");
});

test("ContextAssembler.assemble creates a valid HarnessContext", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {
    conversation: { messages: ["hello", "world"] },
    task: { taskId: "task-123", description: "test task" },
    memory: { lastRun: "run-456" },
    knowledge: { facts: ["fact-1", "fact-2"] },
  };

  const context = assembler.assemble(sources, 1000);

  assert.ok(context.contextId !== undefined);
  assert.equal(context.tokenBudget, 1000);
  assert.deepEqual(context.conversation, { messages: ["hello", "world"] });
  assert.deepEqual(context.task, { taskId: "task-123", description: "test task" });
  assert.deepEqual(context.memory, { lastRun: "run-456" });
  assert.deepEqual(context.knowledge, { facts: ["fact-1", "fact-2"] });
  assert.ok(context.assembledAt !== undefined);
});

test("ContextAssembler.assemble handles empty sources", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {};

  const context = assembler.assemble(sources, 500);

  assert.deepEqual(context.conversation, {});
  assert.deepEqual(context.task, {});
  assert.deepEqual(context.memory, {});
  assert.deepEqual(context.knowledge, {});
});

test("ContextAssembler.assemble creates defensive copies", () => {
  const assembler = new ContextAssembler();
  const sources: HarnessContextSourceSet = {
    conversation: { msg: "original" },
  };

  const context = assembler.assemble(sources, 500);

  // Modifying source should not affect context
  (sources.conversation as Record<string, unknown>)["msg"] = "modified";
  assert.equal(context.conversation["msg"], "original");
});
