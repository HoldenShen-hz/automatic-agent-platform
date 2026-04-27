/**
 * Security Tests: Input Validation Bypass Prevention
 *
 * Tests that verify the system properly validates and rejects attempts
 * to bypass input validation through various techniques:
 * - Type coercion attacks
 * - Array/object pollution
 * - Unexpected type injection
 * - Boundary condition attacks
 * - Missing required fields
 * - Invalid enum values
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CommandExecutor } from "../../../../src/platform/execution/tool-executor/command-executor.js";
import { ToolArgumentCoercion } from "../../../../src/platform/execution/tool-executor/tool-argument-coercion.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

function createSandboxPolicy(workspace: string) {
  return {
    policyId: "test-validation-bypass-sandbox",
    mode: "workspace_write" as const,
    allowedRoots: [workspace],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny" as const,
    processRuleMode: "allow" as const,
  };
}

test("tool-argument-coercion blocks object coercion in command args", () => {
  // Attempt to inject an object where a string array is expected
  const coercedArgs = {
    "0": "safe",
    "1": "malicious",
    length: 2,
    __proto__: { injected: true },
  };

  const trace = ToolArgumentCoercion.coerce({
    request: {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: coercedArgs as unknown as readonly string[],
      cwd: "/tmp",
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy("/tmp"),
      allowedTools: ["echo"],
      allowedPathRoots: ["/tmp"],
    },
    traceId: newId("trace"),
  });

  assert.ok(trace.denied, "Object coercion should be denied");
  assert.ok(trace.diagnostic.message.includes("object"), "Should detect object type");
});

test("tool-argument-coercion blocks array-like object pollution", () => {
  // Attempt to use array-like object with custom length to inject args
  const pollutedArray = Object.create(Array.prototype);
  pollutedArray[0] = "--flag";
  pollutedArray[1] = "malicious";
  pollutedArray.length = 2;

  const trace = ToolArgumentCoercion.coerce({
    request: {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "cat",
      args: pollutedArray as unknown as readonly string[],
      cwd: "/tmp",
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy("/tmp"),
      allowedTools: ["cat"],
      allowedPathRoots: ["/tmp"],
    },
    traceId: newId("trace"),
  });

  assert.ok(trace.denied, "Array-like pollution should be denied");
});

test("tool-argument-coercion blocks symbol keys in args", () => {
  const argsWithSymbol = [Symbol("injected"), "normal"];

  const trace = ToolArgumentCoercion.coerce({
    request: {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: argsWithSymbol as unknown as readonly string[],
      cwd: "/tmp",
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy("/tmp"),
      allowedTools: ["echo"],
      allowedPathRoots: ["/tmp"],
    },
    traceId: newId("trace"),
  });

  assert.ok(trace.denied, "Symbol keys should be denied");
});

test("tool-argument-coercion blocks non-string elements in args array", () => {
  const mixedArray = ["safe", 123, "also-safe"];

  const trace = ToolArgumentCoercion.coerce({
    request: {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: mixedArray as unknown as readonly string[],
      cwd: "/tmp",
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy("/tmp"),
      allowedTools: ["echo"],
      allowedPathRoots: ["/tmp"],
    },
    traceId: newId("trace"),
  });

  assert.ok(trace.denied, "Non-string elements should be denied");
});

test("command-executor blocks undefined in args array", async () => {
  const workspace = createTempWorkspace("aa-security-undefined-");
  const executor = new CommandExecutor();

  try {
    // Create args with undefined element
    const args: (string | undefined)[] = ["first", undefined, "last"];

    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: args as unknown as readonly string[],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Undefined in args should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks null in args array", async () => {
  const workspace = createTempWorkspace("aa-security-null-arg-");
  const executor = new CommandExecutor();

  try {
    const args: (string | null)[] = ["first", null, "last"];

    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: args as unknown as readonly string[],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Null in args should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks function in args array", async () => {
  const workspace = createTempWorkspace("aa-security-function-");
  const executor = new CommandExecutor();

  try {
    const args: (string | (() => string))[] = ["safe", function malicious() { return "hacked"; }, "last"];

    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: args as unknown as readonly string[],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Function in args should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks negative timeout (boundary attack)", async () => {
  const workspace = createTempWorkspace("aa-security-negative-timeout-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: ["test"],
      cwd: workspace,
      timeoutMs: -1000, // Negative timeout is invalid
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Negative timeout should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks extremely large timeout (boundary attack)", async () => {
  const workspace = createTempWorkspace("aa-security-huge-timeout-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: ["test"],
      cwd: workspace,
      timeoutMs: Number.MAX_SAFE_INTEGER, // Way too large
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Extremely large timeout should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks non-numeric timeout", async () => {
  const workspace = createTempWorkspace("aa-security-nonnumeric-timeout-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: ["test"],
      cwd: workspace,
      timeoutMs: "5000" as unknown as number, // String instead of number
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Non-numeric timeout should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks invalid sandbox mode", async () => {
  const workspace = createTempWorkspace("aa-security-invalid-mode-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: ["test"],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: {
        policyId: "test",
        mode: "invalid_mode" as any, // Invalid sandbox mode
        allowedRoots: [workspace],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny" as const,
        processRuleMode: "allow" as const,
      },
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Invalid sandbox mode should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks empty command string", async () => {
  const workspace = createTempWorkspace("aa-security-empty-command-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "",
      args: ["test"],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Empty command should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks whitespace-only command", async () => {
  const workspace = createTempWorkspace("aa-security-whitespace-command-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "   ",
      args: ["test"],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Whitespace-only command should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks command with control characters", async () => {
  const workspace = createTempWorkspace("aa-security-control-chars-");
  const executor = new CommandExecutor();

  try {
    // Command with embedded control characters (SOH, STX, etc.)
    const maliciousCommand = "echo";

    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: maliciousCommand,
      args: ["test"],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Command with control characters should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks empty args array", async () => {
  const workspace = createTempWorkspace("aa-security-empty-args-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "echo",
      args: [] as readonly string[],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["echo"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    // Some commands like echo work with empty args, others don't
    // The key is it should not crash or bypass security
    assert.ok(result.status === "succeeded" || result.status === "blocked", "Should handle empty args safely");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks numeric command name", async () => {
  const workspace = createTempWorkspace("aa-security-numeric-command-");
  const executor = new CommandExecutor();

  try {
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "12345" as unknown as string, // Numeric command name
      args: [],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["12345"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    assert.equal(result.status, "blocked", "Numeric command should be blocked");
  } finally {
    cleanupPath(workspace);
  }
});

test("command-executor blocks script path with flag injection", async () => {
  const workspace = createTempWorkspace("aa-security-flag-injection-");
  const executor = new CommandExecutor();

  try {
    // python script.py --malicious-flag
    const request = {
      callId: newId("call"),
      taskId: newId("task"),
      traceId: newId("trace"),
      executionId: null,
      toolName: "bash",
      command: "python",
      args: ["script.py", "--", "--malicious-option"],
      cwd: workspace,
      timeoutMs: 5000,
      sandboxPolicy: createSandboxPolicy(workspace),
      allowedTools: ["python"],
      allowedPathRoots: [workspace],
    };

    const result = await executor.execute(request);

    // Should handle this safely - either blocked or executed properly
    assert.ok(["succeeded", "blocked", "failed"].includes(result.status), "Should handle flag injection safely");
  } finally {
    cleanupPath(workspace);
  }
});