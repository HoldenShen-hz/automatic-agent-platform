/**
 * Golden Test: Agent State View Service Output Structure
 *
 * Verifies agent state view service produces consistent view
 * for agent runtime monitoring and observability.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { AgentStateViewService } from "../../src/platform/shared/observability/agent-state-view-service.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: agent state view build returns expected structure", () => {
  const service = new AgentStateViewService();

  const view = service.build({
    agentId: "agent-001",
    taskId: "task-001",
    executionId: "exec-001",
    currentPhase: "executing",
    blockerSummaries: ["waiting for approval"],
    activeToolNames: ["read_file", "write_file"],
    pendingApprovals: ["approval-001"],
  });

  // Verify top-level structure
  assert.ok(view, "View should exist");
  assert.ok(view.viewId, "Should have viewId");
  assert.ok(view.viewId.startsWith("agent_state_view_"), "View ID should have correct prefix");
  assert.ok(view.agentId === "agent-001", "Agent ID should match");
  assert.ok(view.taskId === "task-001", "Task ID should match");
  assert.ok(view.executionId === "exec-001", "Execution ID should match");
  assert.ok(view.currentPhase === "executing", "Current phase should match");
  assert.ok(typeof view.blockerCount === "number", "Blocker count should be number");
  assert.ok(Array.isArray(view.activeToolNames), "Active tool names should be array");
  assert.ok(Array.isArray(view.pendingApprovals), "Pending approvals should be array");
  assert.ok(view.generatedAt, "Should have generatedAt");

  assertGolden("agent-state-view-basic", {
    viewIdPrefix: view.viewId.split("_").slice(0, 2).join("_"),
    agentId: view.agentId,
    taskId: view.taskId,
    executionId: view.executionId,
    currentPhase: view.currentPhase,
    blockerCount: view.blockerCount,
    activeToolCount: view.activeToolNames.length,
    pendingApprovalCount: view.pendingApprovals.length,
  });

  // Verify blocker count matches summaries length
  assert.equal(view.blockerCount, 1, "Blocker count should match summaries length");
  assert.equal(view.activeToolNames.length, 2, "Active tool names count should match");
  assert.equal(view.pendingApprovals.length, 1, "Pending approvals count should match");
});

test("golden: agent state view build with minimal input", () => {
  const service = new AgentStateViewService();

  const view = service.build({
    agentId: "agent-minimal",
    taskId: "task-minimal",
    currentPhase: "idle",
  });

  // Verify minimal input produces valid output
  assert.ok(view, "View should exist");
  assert.ok(view.viewId, "Should have viewId");
  assert.ok(view.agentId === "agent-minimal", "Agent ID should match");
  assert.ok(view.taskId === "task-minimal", "Task ID should match");
  assert.ok(view.executionId === null, "Execution ID should be null when not provided");
  assert.ok(view.currentPhase === "idle", "Current phase should match");
  assert.ok(view.blockerCount === 0, "Blocker count should be 0 when no blockers");
  assert.ok(Array.isArray(view.activeToolNames), "Active tool names should be array");
  assert.ok(view.activeToolNames.length === 0, "Active tool names should be empty");
  assert.ok(Array.isArray(view.pendingApprovals), "Pending approvals should be array");
  assert.ok(view.pendingApprovals.length === 0, "Pending approvals should be empty");
  assert.ok(view.generatedAt, "Should have generatedAt");

  assertGolden("agent-state-view-minimal", {
    agentId: view.agentId,
    taskId: view.taskId,
    executionId: view.executionId,
    currentPhase: view.currentPhase,
    blockerCount: view.blockerCount,
    activeToolCount: view.activeToolNames.length,
    pendingApprovalCount: view.pendingApprovals.length,
  });
});

test("golden: agent state view build with multiple blockers and tools", () => {
  const service = new AgentStateViewService();

  const view = service.build({
    agentId: "agent-multi",
    taskId: "task-multi",
    executionId: "exec-multi",
    currentPhase: "planning",
    blockerSummaries: ["resource unavailable", "dependency pending", "rate limited"],
    activeToolNames: ["read_file", "write_file", "execute_command", "list_directory"],
    pendingApprovals: ["approval-001", "approval-002"],
  });

  assert.ok(view.blockerCount === 3, "Blocker count should be 3");
  assert.ok(view.activeToolNames.length === 4, "Active tool count should be 4");
  assert.ok(view.pendingApprovals.length === 2, "Pending approval count should be 2");

  assertGolden("agent-state-view-multi", {
    blockerCount: view.blockerCount,
    activeToolCount: view.activeToolNames.length,
    pendingApprovalCount: view.pendingApprovals.length,
    currentPhase: view.currentPhase,
  });
});

test("golden: agent state view generatedAt is valid ISO timestamp", () => {
  const service = new AgentStateViewService();

  const view = service.build({
    agentId: "agent-ts",
    taskId: "task-ts",
    currentPhase: "executing",
  });

  assert.ok(view.generatedAt, "Should have generatedAt");
  assert.match(view.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "generatedAt should be an ISO timestamp");

  assertGolden("agent-state-view-timestamp", {
    hasGeneratedAt: view.generatedAt.length > 0,
    generatedAtLength: view.generatedAt.length,
  });
});
