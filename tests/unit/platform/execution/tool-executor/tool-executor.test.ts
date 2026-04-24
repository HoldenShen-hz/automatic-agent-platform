import assert from "node:assert/strict";
import test from "node:test";

import { ToolExecutor } from "../../../../../src/platform/execution/tool-executor/tool-executor.js";

test("ToolExecutor delegates command execution to the command executor", async () => {
  let observedCommand = "";
  const executor = new ToolExecutor({
    execute: async (request: { command: string; toolName: string }) => {
      observedCommand = request.command;
      return {
        callId: "call-1",
        toolName: request.toolName,
        status: "succeeded",
        success: true,
        output: "ok",
        data: null,
        metadata: null,
        artifacts: [],
        durationMs: 1,
        error: null,
        executionReceipt: null,
      };
    },
  } as never);

  const result = await executor.executeCommand({
    toolName: "shell.exec",
    command: "echo",
    args: ["ok"],
    cwd: process.cwd(),
    sandboxPolicy: "workspace_write",
  });

  assert.equal(observedCommand, "echo");
  assert.equal(result.success, true);
});

test("ToolExecutor executes concurrent-safe tool items in parallel groups", async () => {
  const executor = new ToolExecutor({ execute: async () => { throw new Error("unused"); } } as never);
  const result = await executor.executeParallel([
    {
      metadata: {
        toolName: "read.a",
        readOnly: true,
        idempotent: true,
        needsFileLock: "read",
        sideEffectScope: "none",
      },
      execute: async () => "a",
    },
    {
      metadata: {
        toolName: "read.b",
        readOnly: true,
        idempotent: true,
        needsFileLock: "read",
        sideEffectScope: "none",
      },
      execute: async () => "b",
    },
  ]);

  assert.deepEqual(result.results, ["a", "b"]);
  assert.equal(result.allSucceeded, true);
});
