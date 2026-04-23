import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionResourceCeilingGuard } from "../../../src/platform/execution/dispatcher/execution-resource-ceiling-guard.js";
test("ExecutionResourceCeilingGuard evaluate returns empty array when no limits exceeded", () => {
    const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100, maxMemoryMb: 1024, maxElapsedMs: 60000 });
    const sample = {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        runtimeInstanceId: null,
        currentStepId: null,
        toolCallCount: 10,
        memoryMb: 256,
        startedAt: new Date(Date.now() - 1000).toISOString(),
        now: new Date().toISOString(),
    };
    const findings = guard.evaluate(sample);
    assert.equal(findings.length, 0);
});
test("ExecutionResourceCeilingGuard firstFinding returns null when no ceiling exceeded", () => {
    const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 100 });
    const sample = {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        toolCallCount: 10,
        now: new Date().toISOString(),
    };
    assert.equal(guard.firstFinding(sample), null);
});
test("ExecutionResourceCeilingGuard evaluate returns finding when tool call limit exceeded", () => {
    const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: 10 });
    const sample = {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        runtimeInstanceId: null,
        currentStepId: null,
        toolCallCount: 50,
        memoryMb: null,
        startedAt: null,
        now: new Date().toISOString(),
    };
    const findings = guard.evaluate(sample);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].dimension, "tool_calls");
    assert.equal(findings[0].actual, 50);
    assert.equal(findings[0].limit, 10);
});
test("ExecutionResourceCeilingGuard evaluate returns finding when memory limit exceeded", () => {
    const guard = new ExecutionResourceCeilingGuard({ maxMemoryMb: 512 });
    const sample = {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        runtimeInstanceId: null,
        currentStepId: null,
        toolCallCount: 5,
        memoryMb: 1024,
        startedAt: null,
        now: new Date().toISOString(),
    };
    const findings = guard.evaluate(sample);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].dimension, "memory_mb");
    assert.equal(findings[0].actual, 1024);
    assert.equal(findings[0].limit, 512);
});
test("ExecutionResourceCeilingGuard evaluate returns finding when elapsed limit exceeded", () => {
    const guard = new ExecutionResourceCeilingGuard({ maxElapsedMs: 5000 });
    const oldTime = new Date(Date.now() - 10000).toISOString();
    const sample = {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        runtimeInstanceId: null,
        currentStepId: null,
        toolCallCount: 1,
        memoryMb: null,
        startedAt: oldTime,
        now: new Date().toISOString(),
    };
    const findings = guard.evaluate(sample);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].dimension, "elapsed_ms");
});
test("ExecutionResourceCeilingGuard null limits mean no checking", () => {
    const guard = new ExecutionResourceCeilingGuard({ maxToolCalls: null, maxMemoryMb: null, maxElapsedMs: null });
    const sample = {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        toolCallCount: 999999,
        memoryMb: 999999,
        startedAt: new Date(Date.now() - 100000).toISOString(),
        now: new Date().toISOString(),
    };
    const findings = guard.evaluate(sample);
    assert.equal(findings.length, 0);
});
//# sourceMappingURL=execution-resource-monitor.test.js.map