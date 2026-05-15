import assert from "node:assert/strict";
import test from "node:test";

import { ToolExecutor } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-executor.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import { READ_TOOL_METADATA } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";

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
    callId: "call-1",
    taskId: "task-1",
    agentId: "agent-1",
    traceId: "trace-1",
    toolName: "shell.exec",
    command: "echo",
    args: ["ok"],
    cwd: process.cwd(),
    sandboxPolicy: createWorkspaceWritePolicy(process.cwd()),
  });

  assert.equal(observedCommand, "echo");
  assert.equal(result.success, true);
});

test("ToolExecutor executes concurrent-safe tool items in parallel groups", async () => {
  const executor = new ToolExecutor({ execute: async () => { throw new Error("unused"); } } as never);
  const result = await executor.executeParallel([
    {
      metadata: { ...READ_TOOL_METADATA, toolName: "read.a" },
      execute: async () => "a",
    },
    {
      metadata: { ...READ_TOOL_METADATA, toolName: "read.b" },
      execute: async () => "b",
    },
  ]);

  assert.deepEqual(result.results, ["a", "b"]);
  assert.equal(result.allSucceeded, true);
});
