import assert from "node:assert/strict";
import test from "node:test";

import { ToolExecutor } from "../../../../src/platform/five-plane-execution/tool-executor/tool-executor.js";
import type {
  CommandExecutor,
  CommandExecutionResult,
} from "../../../../src/platform/five-plane-execution/tool-executor/command-executor.js";
import {
  COMMAND_TOOL_METADATA,
  type CommandToolRequest,
  type ToolExecutionMetadata,
} from "../../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";
import type { SandboxPolicy } from "../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

function mockCommandExecutor(
  execute: (request: CommandToolRequest, signal?: AbortSignal) => Promise<CommandExecutionResult>,
): CommandExecutor {
  return { execute } as unknown as CommandExecutor;
}

function createSandboxPolicy(): SandboxPolicy {
  return {
    policyId: "policy-tool-e2e",
    mode: "workspace_write",
    allowedRoots: ["/tmp"],
    deniedRoots: [],
    realpathEnforced: false,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 60_000,
    memoryLimitBytes: 0,
    cpuLimitFraction: 0,
  };
}

function createParallelMetadata(toolName: string): ToolExecutionMetadata {
  return { ...COMMAND_TOOL_METADATA, toolName };
}

function createRequest(overrides: Partial<CommandToolRequest> = {}): CommandToolRequest {
  return {
    callId: overrides.callId ?? "call-tool-e2e",
    taskId: overrides.taskId ?? "task-tool-e2e",
    agentId: overrides.agentId ?? "agent-tool-e2e",
    traceId: overrides.traceId ?? "trace-tool-e2e",
    toolName: overrides.toolName ?? "command_exec",
    sandboxPolicy: overrides.sandboxPolicy ?? createSandboxPolicy(),
    command: overrides.command ?? "echo",
    args: overrides.args ?? ["hello"],
    cwd: overrides.cwd ?? "/tmp",
    ...(overrides.timeoutMs != null ? { timeoutMs: overrides.timeoutMs } : {}),
  };
}

test("E2E ToolExecutor: executeCommand returns the underlying command envelope", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async (request) => ({
      callId: request.callId,
      toolName: request.toolName,
      status: "succeeded",
      success: true,
      output: {
        sanitizedText: "hello",
        warnings: [],
        truncated: false,
        redactionCount: 0,
        controlCharsRemoved: 0,
        ansiRemoved: false,
        nfcNormalized: false,
        unicodeTagsRemoved: 0,
        zeroWidthCharsRemoved: 0,
        privateUseCharsRemoved: 0,
        injectionRisk: "none",
        matchedInjectionRules: [],
        rawRef: null,
      },
      data: {
        rawRef: null,
        truncated: false,
        redactionCount: 0,
        controlCharsRemoved: 0,
        ansiRemoved: false,
        injectionRisk: "none",
        matchedInjectionRules: [],
      },
      metadata: {
        command: request.command,
        args: request.args,
        cwd: request.cwd,
        warnings: [],
        coercions: [],
        artifactCount: 0,
      },
      artifacts: [],
      durationMs: 10,
      error: null,
      executionReceipt: "receipt-1",
    })),
  );

  const result = await executor.executeCommand(createRequest());

  assert.equal(result.status, "succeeded");
  assert.equal(result.success, true);
  assert.equal(result.metadata.command, "echo");
});

test("E2E ToolExecutor: passes AbortSignal through to the command executor", async () => {
  let receivedSignal: AbortSignal | undefined;
  const executor = new ToolExecutor(
    mockCommandExecutor(async (request, signal) => {
      receivedSignal = signal;
      return {
        callId: request.callId,
        toolName: request.toolName,
        status: "succeeded",
        success: true,
        output: {
          sanitizedText: "",
          warnings: [],
          truncated: false,
          redactionCount: 0,
          controlCharsRemoved: 0,
          ansiRemoved: false,
          nfcNormalized: false,
          unicodeTagsRemoved: 0,
          zeroWidthCharsRemoved: 0,
          privateUseCharsRemoved: 0,
          injectionRisk: "none",
          matchedInjectionRules: [],
          rawRef: null,
        },
        data: {
          rawRef: null,
          truncated: false,
          redactionCount: 0,
          controlCharsRemoved: 0,
          ansiRemoved: false,
          injectionRisk: "none",
          matchedInjectionRules: [],
        },
        metadata: {
          command: request.command,
          args: request.args,
          cwd: request.cwd,
          warnings: [],
          coercions: [],
          artifactCount: 0,
        },
        artifacts: [],
        durationMs: 0,
        error: null,
        executionReceipt: null,
      };
    }),
  );

  const controller = new AbortController();
  await executor.executeCommand(createRequest({ command: "sleep", args: ["1"] }), controller.signal);

  assert.ok(receivedSignal);
});

test("E2E ToolExecutor: executeParallel aggregates multiple items", async () => {
  const executor = new ToolExecutor(mockCommandExecutor(async () => {
    throw new Error("unused");
  }));

  const result = await executor.executeParallel([
    {
      metadata: createParallelMetadata("parallel.a"),
      execute: async () => "alpha",
    },
    {
      metadata: createParallelMetadata("parallel.b"),
      execute: async () => "beta",
    },
  ]);

  assert.equal(result.allSucceeded, true);
  assert.deepEqual(result.results, ["alpha", "beta"]);
});
