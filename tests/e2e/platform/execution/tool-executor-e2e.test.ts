/**
 * E2E Tests for Tool Executor
 *
 * End-to-end tests covering:
 * 1. Tool execution lifecycle
 * 2. Tool timeout handling
 * 3. Tool error propagation
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../../helpers/e2e-harness.js";
// @ts-ignore
import { ToolExecutorService } from "../../../src/platform/five-plane-execution/tool-executor/tool-executor-service.js";
// @ts-ignore
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
// @ts-ignore
import type { ToolExecutionRequest, ToolDefinition } from "../../../src/platform/contracts/tool-schemas.js";

function createToolDefinition(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: overrides.name ?? "test_tool",
    description: overrides.description ?? "A test tool",
    inputSchema: overrides.inputSchema ?? { type: "object" },
    outputSchema: overrides.outputSchema ?? { type: "object" },
    timeoutMs: overrides.timeoutMs ?? 5000,
    retryable: overrides.retryable ?? true,
    ...overrides,
  };
}

function createToolRequest(overrides: Partial<ToolExecutionRequest> = {}): ToolExecutionRequest {
  return {
    executionId: overrides.executionId ?? newId("exec"),
    toolCallId: overrides.toolCallId ?? newId("tc"),
    tool: overrides.tool ?? createToolDefinition(),
    input: overrides.input ?? {},
    timeoutMs: overrides.timeoutMs ?? 5000,
    retryCount: overrides.retryCount ?? 0,
    ...overrides,
  };
}

test("E2E ToolExecutor: Executes tool and returns result", async () => {
  const harness = createE2EHarness("aa-e2e-tool-exec-");
  try {
    const executor = new ToolExecutorService();

    const request = createToolRequest({
      tool: createToolDefinition({ name: "echo" }),
      input: { message: "hello" },
    });

    const result = await executor.execute(request);

    assert.equal(result.status, "completed");
    assert.equal(result.toolCallId, request.toolCallId);
  } finally {
    harness.cleanup();
  }
});

test("E2E ToolExecutor: Handles tool timeout", async () => {
  const harness = createE2EHarness("aa-e2e-tool-timeout-");
  try {
    const executor = new ToolExecutorService();

    const request = createToolRequest({
      tool: createToolDefinition({ name: "slow_tool", timeoutMs: 10 }),
      input: { delayMs: 100 },
      timeoutMs: 10,
    });

    const result = await executor.execute(request);

    assert.equal(result.status, "timeout");
  } finally {
    harness.cleanup();
  }
});

test("E2E ToolExecutor: Propagates tool errors correctly", async () => {
  const harness = createE2EHarness("aa-e2e-tool-error-");
  try {
    const executor = new ToolExecutorService();

    const request = createToolRequest({
      tool: createToolDefinition({ name: "error_tool" }),
      input: { shouldFail: true },
    });

    const result = await executor.execute(request);

    assert.ok(result.status === "error" || result.status === "failed");
    assert.ok(result.error !== undefined || result.errorMessage !== undefined);
  } finally {
    harness.cleanup();
  }
});