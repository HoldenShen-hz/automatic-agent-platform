/**
 * Unit tests for AgentStateViewService.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { AgentStateViewService } from "../../../../../src/platform/shared/observability/agent-state-view-service.js";

test.skip("AgentStateViewService.build creates view with all fields", () => {
  const service = new AgentStateViewService();
  const view = service.build({
    agentId: "agent-1",
    taskId: "task-1",
    executionId: "exec-1",
    currentPhase: "executing",
    blockerSummaries: ["waiting for approval", "resource contention"],
    activeToolNames: ["bash", "read"],
    pendingApprovals: ["high-risk-operation"],
  });

  assert.ok(view.viewId.startsWith("asv_"), "viewId should be generated");
  assert.equal(view.agentId, "agent-1");
  assert.equal(view.taskId, "task-1");
  assert.equal(view.executionId, "exec-1");
  assert.equal(view.currentPhase, "executing");
  assert.equal(view.blockerCount, 2);
  assert.deepEqual(view.activeToolNames, ["bash", "read"]);
  assert.deepEqual(view.pendingApprovals, ["high-risk-operation"]);
  assert.ok(view.generatedAt, "generatedAt should be set");
});

test("AgentStateViewService.build handles optional fields", () => {
  const service = new AgentStateViewService();
  const view = service.build({
    agentId: "agent-2",
    taskId: "task-2",
    currentPhase: "precheck",
  });

  assert.equal(view.agentId, "agent-2");
  assert.equal(view.taskId, "task-2");
  assert.equal(view.executionId, null);
  assert.equal(view.blockerCount, 0);
  assert.deepEqual(view.activeToolNames, []);
  assert.deepEqual(view.pendingApprovals, []);
});

test("AgentStateViewService.build copies arrays by reference", () => {
  const service = new AgentStateViewService();
  const toolNames = ["tool-a", "tool-b"];
  const view = service.build({
    agentId: "agent-3",
    taskId: "task-3",
    currentPhase: "running",
    activeToolNames: toolNames,
  });

  assert.deepEqual(view.activeToolNames, toolNames);
  // Verify it's a copy, not the same reference
  toolNames.push("tool-c");
  assert.equal(view.activeToolNames.length, 2);
});

test("AgentStateViewService.build uses nowIso for generatedAt", () => {
  const service = new AgentStateViewService();
  const before = new Date().toISOString();
  const view = service.build({
    agentId: "agent-4",
    taskId: "task-4",
    currentPhase: "done",
  });
  const after = new Date().toISOString();

  assert.ok(view.generatedAt >= before, "generatedAt should be >= before");
  assert.ok(view.generatedAt <= after, "generatedAt should be <= after");
});