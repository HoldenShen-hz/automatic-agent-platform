import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ExecutionResourceCeilingGuard,
  type ExecutionResourceUsageSample,
  type ExecutionResourceCeilingFinding,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-resource-ceiling-guard.js";

describe("ExecutionResourceCeilingGuard", () => {
  const createSample = (overrides: Partial<ExecutionResourceUsageSample> = {}): ExecutionResourceUsageSample =>
    ({
      executionId: "exec-123",
      taskId: "task-456",
      agentId: "agent-789",
      status: "running",
      runtimeInstanceId: "instance-abc",
      currentStepId: "step-1",
      toolCallCount: 10,
      memoryMb: 512,
      startedAt: "2026-05-02T00:00:00.000Z",
      now: "2026-05-02T00:01:00.000Z",
      ...overrides,
    });

  describe("evaluate", () => {
    it("should return empty array when no limits are exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 100,
        maxMemoryMb: 1024,
        maxElapsedMs: 600000,
      });

      const sample = createSample({
        toolCallCount: 50,
        memoryMb: 512,
        startedAt: "2026-05-02T00:00:00.000Z",
        now: "2026-05-02T00:01:00.000Z",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });

    it("should detect tool call ceiling exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 64,
        maxMemoryMb: null,
        maxElapsedMs: null,
      });

      const sample = createSample({
        toolCallCount: 100,
        memoryMb: 512,
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 1);
      assert.equal(findings[0].dimension, "tool_calls");
      assert.equal(findings[0].reasonCode, "agent.resource_limit.tool_calls_exceeded");
      assert.equal(findings[0].actual, 100);
      assert.equal(findings[0].limit, 64);
      assert.equal(findings[0].unit, "count");
      assert.ok(findings[0].message.includes("exceeded"));
    });

    it("should detect memory ceiling exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: null,
        maxMemoryMb: 1024,
        maxElapsedMs: null,
      });

      const sample = createSample({
        toolCallCount: 10,
        memoryMb: 2048,
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 1);
      assert.equal(findings[0].dimension, "memory_mb");
      assert.equal(findings[0].reasonCode, "agent.resource_limit.memory_exceeded");
      assert.equal(findings[0].actual, 2048);
      assert.equal(findings[0].limit, 1024);
      assert.equal(findings[0].unit, "mb");
    });

    it("should detect elapsed time ceiling exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: null,
        maxMemoryMb: null,
        maxElapsedMs: 60000,
      });

      const sample = createSample({
        startedAt: "2026-05-02T00:00:00.000Z",
        now: "2026-05-02T00:02:00.000Z",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 1);
      assert.equal(findings[0].dimension, "elapsed_ms");
      assert.equal(findings[0].reasonCode, "agent.resource_limit.elapsed_exceeded");
      assert.equal(findings[0].actual, 120000);
      assert.equal(findings[0].limit, 60000);
      assert.equal(findings[0].unit, "ms");
    });

    it("should return multiple findings when multiple ceilings exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 5,
        maxMemoryMb: 256,
        maxElapsedMs: 600000, // 10 minutes - won't trigger for 5s sample
      });

      const sample = createSample({
        toolCallCount: 10,
        memoryMb: 512,
        startedAt: "2026-05-02T00:00:00.000Z",
        now: "2026-05-02T00:00:05.000Z",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 2);
      assert.ok(findings.some((f) => f.dimension === "tool_calls"));
      assert.ok(findings.some((f) => f.dimension === "memory_mb"));
    });

    it("should not trigger when tool calls are at limit", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 64,
      });

      const sample = createSample({ toolCallCount: 64 });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });

    it("should not trigger when tool calls exceed by 0", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 64,
      });

      const sample = createSample({ toolCallCount: 65 });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 1);
      assert.equal(findings[0].dimension, "tool_calls");
    });

    it("should ignore null limits (no limit)", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: null,
        maxMemoryMb: null,
        maxElapsedMs: null,
      });

      const sample = createSample({
        toolCallCount: 1000000,
        memoryMb: 1000000,
        startedAt: "2026-01-01T00:00:00.000Z",
        now: "2026-05-02T00:00:00.000Z",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });

    it("should handle null toolCallCount in sample", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 9,
      });

      const sample = createSample({ toolCallCount: null });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });

    it("should handle null memoryMb in sample", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxMemoryMb: 512,
      });

      const sample = createSample({ memoryMb: null });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });

    it("should handle null startedAt when elapsed limit is set", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxElapsedMs: 1000,
      });

      const sample = createSample({ startedAt: null });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });

    it("should use now from sample when provided", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxElapsedMs: 60000,
      });

      const sample = createSample({
        startedAt: "2026-05-02T00:00:00.000Z",
        now: "2026-05-02T00:02:00.000Z",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings[0].actual, 120000);
    });

    it("should include execution metadata in finding", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 9,
      });

      const sample = createSample({
        executionId: "my-exec",
        taskId: "my-task",
        agentId: "my-agent",
        status: "running",
        runtimeInstanceId: "runtime-1",
        currentStepId: "step-5",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings[0].executionId, "my-exec");
      assert.equal(findings[0].taskId, "my-task");
      assert.equal(findings[0].agentId, "my-agent");
      assert.equal(findings[0].status, "running");
      assert.equal(findings[0].runtimeInstanceId, "runtime-1");
      assert.equal(findings[0].currentStepId, "step-5");
      assert.ok(findings[0].observedAt.length > 0);
    });
  });

  describe("firstFinding", () => {
    it("should return first finding when multiple limits exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 5,
        maxMemoryMb: 256,
      });

      const sample = createSample({
        toolCallCount: 10,
        memoryMb: 512,
      });

      const finding = guard.firstFinding(sample);

      assert.notEqual(finding, null);
      assert.ok(finding !== null);
    });

    it("should return null when no limits exceeded", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 100,
      });

      const sample = createSample({ toolCallCount: 50 });

      const finding = guard.firstFinding(sample);

      assert.equal(finding, null);
    });
  });

  describe("resolveLimit", () => {
    it("should use fallback for invalid values", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: 0,
        maxMemoryMb: -5,
        maxElapsedMs: NaN,
      });

      const sample = createSample({
        toolCallCount: 1000000,
        memoryMb: 1000000,
        startedAt: "2026-01-01T00:00:00.000Z",
        now: "2026-05-02T00:00:00.000Z",
      });

      // Since we pass null, it uses fallback but then those fallbacks become the limits
      // So 1000000 exceeds 64, 1000000 exceeds 2048, and 1.3B ms exceeds 900000
      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 3);
    });

    it("should respect explicit null (no limit)", () => {
      const guard = new ExecutionResourceCeilingGuard({
        maxToolCalls: null,
        maxMemoryMb: null,
        maxElapsedMs: null,
      });

      const sample = createSample({
        toolCallCount: 100,
        memoryMb: 10000,
        startedAt: "2026-01-01T00:00:00.000Z",
        now: "2026-05-02T00:00:00.000Z",
      });

      const findings = guard.evaluate(sample);

      assert.equal(findings.length, 0);
    });
  });
});
