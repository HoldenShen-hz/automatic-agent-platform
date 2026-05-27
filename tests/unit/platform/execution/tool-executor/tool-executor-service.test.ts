import assert from "node:assert/strict";
import test from "node:test";

import { ToolExecutor } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-executor.js";
import type { CommandExecutor, CommandExecutionResult } from "../../../../../src/platform/five-plane-execution/tool-executor/command-executor.js";
import type { CommandToolRequest } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";
import type { ToolSideEffectScope, ToolRiskLevel, ToolPathScopeMode, ToolOutputKind, ToolApprovalMode, ToolNeedsFileLock, ToolRecoveryStrategy, ToolExecutionMetadata } from "../../../../../src/platform/five-plane-execution/tool-executor/tool-metadata.js";

function mockCommandExecutor(
  execute: (request: CommandToolRequest) => Promise<CommandExecutionResult>,
): CommandExecutor {
  return { execute } as unknown as CommandExecutor;
}

function createMetadata(overrides: Partial<ToolExecutionMetadata> = {}): ToolExecutionMetadata {
  return {
    toolName: "read.test",
    readOnly: true,
    idempotent: true,
    needsFileLock: "read",
    sideEffectScope: "none",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "low",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 15000,
    retryableErrorCodes: [],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
    isConcurrencySafe: true,
    ...overrides,
  } as ToolExecutionMetadata;
}

test("ToolExecutor executeCommand returns CommandExecutionResult with correct envelope [tool-executor-service]", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async (request: CommandToolRequest) => ({
      callId: request.callId,
      toolName: request.toolName,
      status: "succeeded",
      success: true,
      output: { sanitizedText: "hello", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: request.command, args: request.args, cwd: request.cwd, warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 42,
      error: null,
      executionReceipt: `ok:${request.callId}`,
    })),
  );

  const result = await executor.executeCommand({
    callId: "call-service-1",
    taskId: "task-1",
    agentId: "agent-1",
    traceId: "trace-1",
    toolName: "command_exec",
    timeoutMs: 5000,
    sandboxPolicy: { policyId: "p1", mode: "workspace_write", allowedRoots: ["/tmp"], deniedRoots: [], realpathEnforced: false, symlinkPolicy: "deny", processRuleMode: "allow" },
    command: "echo",
    args: ["hello"],
    cwd: "/tmp",
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.success, true);
  assert.equal(result.callId, "call-service-1");
  assert.equal(result.toolName, "command_exec");
  assert.equal(result.durationMs, 42);
  assert.equal(result.error, null);
});

test("ToolExecutor executeCommand propagates timeout via AbortSignal [tool-executor-service]", async () => {
  let receivedSignal: AbortSignal | undefined;
  const executor = new ToolExecutor(
    mockCommandExecutor(async (_request: CommandToolRequest, signal?: AbortSignal) => {
      receivedSignal = signal;
      return {
        callId: _request.callId,
        toolName: _request.toolName,
        status: "succeeded",
        success: true,
        output: { sanitizedText: "", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
        data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
        metadata: { command: _request.command, args: _request.args, cwd: _request.cwd, warnings: [], coercions: [], artifactCount: 0 },
        artifacts: [],
        durationMs: 0,
        error: null,
        executionReceipt: null,
      };
    }),
  );

  const controller = new AbortController();
  await executor.executeCommand({
    callId: "call-signal",
    taskId: "task-signal",
    agentId: "agent-signal",
    traceId: "trace-signal",
    toolName: "command_exec",
    sandboxPolicy: { policyId: "p1", mode: "workspace_write", allowedRoots: ["/tmp"], deniedRoots: [], realpathEnforced: false, symlinkPolicy: "deny", processRuleMode: "allow" },
    command: "sleep",
    args: ["1"],
    cwd: "/tmp",
  }, controller.signal);

  assert.ok(receivedSignal !== undefined);
});

test("ToolExecutor executeCommand returns failed status on command failure [tool-executor-service]", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async (request: CommandToolRequest) => ({
      callId: request.callId,
      toolName: request.toolName,
      status: "failed",
      success: false,
      output: { sanitizedText: "command not found", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: request.command, args: request.args, cwd: request.cwd, warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 5,
      error: { code: "tool.command_failed", message: "Command exited with code 1", retryable: false, source: "tool" },
      executionReceipt: null,
    })),
  );

  const result = await executor.executeCommand({
    callId: "call-fail",
    taskId: "task-fail",
    agentId: "agent-fail",
    traceId: "trace-fail",
    toolName: "command_exec",
    sandboxPolicy: { policyId: "p1", mode: "workspace_write", allowedRoots: ["/tmp"], deniedRoots: [], realpathEnforced: false, symlinkPolicy: "deny", processRuleMode: "allow" },
    command: "false",
    args: [],
    cwd: "/tmp",
  });

  assert.equal(result.status, "failed");
  assert.equal(result.success, false);
  assert.equal(result.error?.code, "tool.command_failed");
  assert.equal(result.error?.retryable, false);
});

test("ToolExecutor executeCommand returns blocked status for denied commands [tool-executor-service]", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async (request: CommandToolRequest) => ({
      callId: request.callId,
      toolName: request.toolName,
      status: "blocked",
      success: false,
      output: { sanitizedText: "Command blocked by sandbox or command policy.", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: request.command, args: request.args, cwd: request.cwd, warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 0,
      error: { code: "tool.command_denied", message: "tool.command_denied", retryable: false, source: "security" },
      executionReceipt: null,
    })),
  );

  const result = await executor.executeCommand({
    callId: "call-blocked",
    taskId: "task-blocked",
    agentId: "agent-blocked",
    traceId: "trace-blocked",
    toolName: "command_exec",
    sandboxPolicy: { policyId: "p1", mode: "workspace_write", allowedRoots: ["/tmp"], deniedRoots: [], realpathEnforced: false, symlinkPolicy: "deny", processRuleMode: "allow" },
    command: "dangerous",
    args: [],
    cwd: "/tmp",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.success, false);
  assert.equal(result.error?.source, "security");
});

test("ToolExecutor executeCommand serializes result metadata correctly [tool-executor-service]", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async (request: CommandToolRequest) => ({
      callId: request.callId,
      toolName: request.toolName,
      status: "succeeded",
      success: true,
      output: { sanitizedText: "output-text", warnings: ["output_truncated"], truncated: true, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: "artifact://ref" },
      data: { rawRef: "artifact://ref", truncated: true, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: "echo", args: ["test"], cwd: "/tmp", warnings: ["output_truncated"], coercions: [], artifactCount: 1 },
      artifacts: ["artifact://ref"],
      durationMs: 15,
      error: null,
      executionReceipt: "ok:call-serial",
    })),
  );

  const result = await executor.executeCommand({
    callId: "call-serial",
    taskId: "task-serial",
    agentId: "agent-serial",
    traceId: "trace-serial",
    toolName: "command_exec",
    sandboxPolicy: { policyId: "p1", mode: "workspace_write", allowedRoots: ["/tmp"], deniedRoots: [], realpathEnforced: false, symlinkPolicy: "deny", processRuleMode: "allow" },
    command: "echo",
    args: ["test"],
    cwd: "/tmp",
  });

  assert.equal(result.metadata.command, "echo");
  assert.deepEqual(result.metadata.args, ["test"]);
  assert.equal(result.metadata.cwd, "/tmp");
  assert.equal(result.output.truncated, true);
  assert.equal(result.output.rawRef, "artifact://ref");
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0], "artifact://ref");
  assert.ok(result.output.warnings.includes("output_truncated"));
});

test("ToolExecutor executeParallel respects concurrency-safe grouping [tool-executor-service]", async () => {
  const callOrder: number[] = [];
  const executor = new ToolExecutor(
    mockCommandExecutor(async () => ({
      callId: "call-parallel",
      toolName: "command_exec",
      status: "succeeded",
      success: true,
      output: { sanitizedText: "", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: "", args: [], cwd: "/tmp", warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 0,
      error: null,
      executionReceipt: null,
    })),
  );

  const result = await executor.executeParallel([
    {
      metadata: createMetadata({ toolName: "read.a" }),
      execute: async () => { callOrder.push(1); return "result-a"; },
    },
    {
      metadata: createMetadata({ toolName: "read.b" }),
      execute: async () => { callOrder.push(2); return "result-b"; },
    },
  ]);

  assert.equal(result.allSucceeded, true);
  assert.equal(result.anyFailed, false);
  assert.deepEqual(result.results, ["result-a", "result-b"]);
});

test("ToolExecutor executeParallel reports failures in errors array [tool-executor-service]", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async () => ({
      callId: "call-parallel-error",
      toolName: "command_exec",
      status: "succeeded",
      success: true,
      output: { sanitizedText: "", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: "", args: [], cwd: "/tmp", warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 0,
      error: null,
      executionReceipt: null,
    })),
  );

  const result = await executor.executeParallel([
    {
      metadata: createMetadata({ toolName: "read.ok" }),
      execute: async () => "ok",
    },
    {
      metadata: createMetadata({ toolName: "read.fail" }),
      execute: async () => { throw new Error("intentional failure"); },
    },
  ]);

  assert.equal(result.allSucceeded, false);
  assert.equal(result.anyFailed, true);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0], "ok");
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0] !== undefined);
  assert.equal(result.errors[0].toolName, "read.fail");
});

test("ToolExecutor executeParallel uses maxParallelism option [tool-executor-service]", async () => {
  let concurrentCount = 0;
  let maxSeen = 0;
  const executor = new ToolExecutor(
    mockCommandExecutor(async () => ({
      callId: "call-max",
      toolName: "command_exec",
      status: "succeeded",
      success: true,
      output: { sanitizedText: "", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: "", args: [], cwd: "/tmp", warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 0,
      error: null,
      executionReceipt: null,
    })),
  );

  const items = Array.from({ length: 4 }, (_, i) => ({
    metadata: createMetadata({ toolName: `read.${i}` }),
    execute: async () => {
      concurrentCount++;
      if (concurrentCount > maxSeen) maxSeen = concurrentCount;
      await new Promise(resolve => setImmediate(resolve));
      concurrentCount--;
      return `result-${i}`;
    },
  }));

  const result = await executor.executeParallel(items, { maxParallelism: 2 });

  assert.equal(result.allSucceeded, true);
  assert.equal(maxSeen, 2);
});

test("ToolExecutor defaults parallelOptions to empty object when not provided [tool-executor-service]", async () => {
  const executor = new ToolExecutor(
    mockCommandExecutor(async () => ({
      callId: "call-defaults",
      toolName: "command_exec",
      status: "succeeded",
      success: true,
      output: { sanitizedText: "", warnings: [], truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, nfcNormalized: false, unicodeTagsRemoved: 0, zeroWidthCharsRemoved: 0, privateUseCharsRemoved: 0, injectionRisk: "none" as const, matchedInjectionRules: [], rawRef: null },
      data: { rawRef: null, truncated: false, redactionCount: 0, controlCharsRemoved: 0, ansiRemoved: false, injectionRisk: "none", matchedInjectionRules: [] },
      metadata: { command: "", args: [], cwd: "/tmp", warnings: [], coercions: [], artifactCount: 0 },
      artifacts: [],
      durationMs: 0,
      error: null,
      executionReceipt: null,
    })),
  );

  const result = await executor.executeParallel([
    {
      metadata: createMetadata({ toolName: "read.one" }),
      execute: async () => "one",
    },
  ]);

  assert.equal(result.allSucceeded, true);
});
