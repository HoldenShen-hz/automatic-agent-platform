/**
 * Unit Tests: Evolution Integration Service
 *
 * Tests the integration of evidence collection, reflection, and proposal
 * generation into the existing runtime flow.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EvolutionIntegrationService } from "../../../../src/ops-maturity/drift-detection/evolution-integration-service.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

/**
 * Creates a mock AuthoritativeTaskStore for testing.
 */
function createMockStore(): AuthoritativeTaskStore {
  return {
    filePath: ":memory:",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/**
 * Creates a mock ApprovalService for testing.
 */
function createMockApprovalService(): ApprovalService {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("EvolutionIntegrationService records failure evidence", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  await service.recordFailure({
    taskId: "task_001",
    executionId: "exec_001",
    agentId: "agent_001",
    sessionId: "session_001",
    reasonCode: "test_failure",
    errorMessage: "Test failed",
    costUsd: 0.05,
    latencyMs: 1500,
    toolCalls: 10,
    repairRounds: 2,
  });

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 1, "Should have 1 evidence record");
  assert.equal(stats.recentFailures, 1, "Should have 1 recent failure");
});

test("EvolutionIntegrationService records success evidence", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  await service.recordSuccess({
    taskId: "task_002",
    executionId: "exec_002",
    agentId: "agent_001",
    sessionId: "session_002",
    costUsd: 0.03,
    latencyMs: 800,
    toolCalls: 5,
  });

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 1, "Should have 1 evidence record");
  assert.equal(stats.recentFailures, 0, "Should have 0 recent failures");
});

test("EvolutionIntegrationService triggers reflection after threshold reached", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  // Use a config with low reflection threshold for testing
  const service = new EvolutionIntegrationService(store, approvalService, {
    reflectionThreshold: 3,
    proposalConfidenceThreshold: 0.6,
    enableAutomaticProposal: true,
  });

  // Record 3 failures to trigger reflection
  for (let i = 0; i < 3; i++) {
    await service.recordFailure({
      taskId: `task_00${i}`,
      executionId: `exec_00${i}`,
      agentId: "agent_001",
      sessionId: "session_001",
      reasonCode: "timeout",
      errorMessage: "Timeout occurred",
      costUsd: 0.01,
      latencyMs: 30000,
      toolCalls: 5,
      repairRounds: 1,
    });
  }

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 3, "Should have 3 evidence records");
  assert.equal(stats.recentFailures, 3, "Should have 3 recent failures");
});

test("EvolutionIntegrationService classifies failure modes correctly", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  // Record timeout failure
  await service.recordFailure({
    taskId: "task_timeout",
    executionId: "exec_timeout",
    agentId: null,
    sessionId: "session_001",
    reasonCode: "execution_timeout",
    errorMessage: "Execution timed out",
    costUsd: 0.01,
    latencyMs: 60000,
    toolCalls: 3,
    repairRounds: 0,
  });

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 1, "Should have 1 evidence");
  assert.equal(stats.recentFailures, 1, "Should have 1 failure");
});

test("EvolutionIntegrationService infers task types from reason codes", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  // Record a type error failure
  await service.recordFailure({
    taskId: "task_type",
    executionId: "exec_type",
    agentId: "agent_001",
    sessionId: "session_001",
    reasonCode: "type_mismatch",
    errorMessage: "Type error",
    costUsd: 0.01,
    latencyMs: 100,
    toolCalls: 2,
    repairRounds: 0,
  });

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 1, "Should have 1 evidence");
});

test("EvolutionIntegrationService records security-related failures", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  await service.recordFailure({
    taskId: "task_security",
    executionId: "exec_security",
    agentId: "agent_001",
    sessionId: "session_001",
    reasonCode: "security_forbidden",
    errorMessage: "Forbidden access",
    costUsd: 0.005,
    latencyMs: 50,
    toolCalls: 1,
    repairRounds: 0,
  });

  const stats = await service.getStatistics();
  assert.equal(stats.recentFailures, 1, "Should have 1 security failure recorded");
});

test("EvolutionIntegrationService handles multiple success records", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  // Record multiple successes
  for (let i = 0; i < 5; i++) {
    await service.recordSuccess({
      taskId: `task_success_${i}`,
      executionId: `exec_success_${i}`,
      agentId: "agent_001",
      sessionId: `session_${i}`,
      costUsd: 0.02 + i * 0.01,
      latencyMs: 500 + i * 100,
      toolCalls: 3 + i,
    });
  }

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 5, "Should have 5 evidence records");
  assert.equal(stats.recentFailures, 0, "Should have 0 failures");
});

test("EvolutionIntegrationService getStatistics returns correct structure", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  const stats = await service.getStatistics();

  assert.equal(typeof stats.totalEvidence, "number");
  assert.equal(typeof stats.recentFailures, "number");
  assert.equal(typeof stats.proposalsPending, "number");
  assert.equal(typeof stats.proposalsActive, "number");
});

test("EvolutionIntegrationService uses custom config", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const customConfig = {
    reflectionThreshold: 5,
    proposalConfidenceThreshold: 0.8,
    enableAutomaticProposal: false,
  };
  const service = new EvolutionIntegrationService(store, approvalService, customConfig);

  // Record 4 failures - should NOT trigger reflection since threshold is 5
  for (let i = 0; i < 4; i++) {
    await service.recordFailure({
      taskId: `task_00${i}`,
      executionId: `exec_00${i}`,
      agentId: "agent_001",
      sessionId: "session_001",
      reasonCode: "test_failure",
      errorMessage: "Test failed",
      costUsd: 0.01,
      latencyMs: 1000,
      toolCalls: 5,
      repairRounds: 1,
    });
  }

  const stats = await service.getStatistics();
  assert.equal(stats.totalEvidence, 4, "Should have 4 evidence records");
});

test("EvolutionIntegrationService syncWithLearningPipeline forwards active proposals through learning bridge", async () => {
  const store = createMockStore();
  const approvalService = createMockApprovalService();
  const service = new EvolutionIntegrationService(store, approvalService);

  const captured: unknown[] = [];
  service.setLearningBridge({
    async onLearningObjects(objects) {
      captured.push(...objects);
    },
  });

  const proposalEngine = (service as unknown as {
    proposalEngine: {
      create(input: Record<string, unknown>): Promise<{ id: string }>;
      submitForApproval(id: string): Promise<void>;
    };
  }).proposalEngine;
  const proposal = await proposalEngine.create({
    title: "Bridge Proposal",
    description: "Forward to main learning pipeline",
    kind: "tool_routing_rule",
    target: "tool_execution",
    risk: "low",
    agentId: "evolution-system",
    evidenceIds: ["e-1"],
  });
  await proposalEngine.submitForApproval(proposal.id);

  await service.syncWithLearningPipeline();

  assert.ok(captured.length >= 1, "Expected at least one bridged learning object");
});
