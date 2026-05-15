/**
 * Unit tests for EvolutionMvpService class methods.
 *
 * Tests the service methods with mock dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EvolutionMvpService } from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-service.js";
import type {
  EvolutionPolicyRecord,
  EvolutionProposalRecord,
  EvolutionProposalStatus,
} from "../../../../../src/platform/contracts/types/domain.js";
import type { BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import type { ApprovalRequest, ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Types and Implementations
// ─────────────────────────────────────────────────────────────────────────────

interface MockEvolutionStore {
  proposals: Map<string, EvolutionProposalRecord>;
  policies: EvolutionPolicyRecord[];
  logs: Array<{
    id: string;
    proposalId: string;
    taskId: string;
    executionId: string | null;
    eventType: string;
    reasonCode: string;
    beforeStateJson: string | null;
    afterStateJson: string | null;
    metadataJson: string;
    createdAt: string;
  }>;
}

interface MockEventStore {
  events: Array<{
    id: string;
    taskId: string;
    executionId: string | null;
    sessionId: string | null;
    eventType: string;
    eventTier: string;
    payloadJson: string;
    traceId: string | null;
    createdAt: string;
  }>;
}

function createMockEvolutionStore(): MockEvolutionStore {
  return {
    proposals: new Map(),
    policies: [],
    logs: [],
  };
}

function createMockEventStore(): MockEventStore {
  return {
    events: [],
  };
}

function createMockApprovalService(): ApprovalService & {
  requests: Map<string, ApprovalRequest & { approvalId: string; status: string; respondedAt?: string }>;
  createRequestCalls: Array<{
    taskId: string;
    executionId: string | null;
    sourceAgentId: string;
    reason: string;
    riskLevel: string;
    options: readonly string[];
    context: Record<string, unknown>;
    timeoutPolicy: string;
  }>;
} {
  return {
    requests: new Map(),
    createRequestCalls: [],
    createRequest(input: {
      taskId: string;
      executionId?: string | null;
      sourceAgentId: string;
      reason: string;
      riskLevel: string;
      options: readonly string[];
      context: Record<string, unknown>;
      timeoutPolicy: string;
    }): ApprovalRequest {
      this.createRequestCalls.push(input as any);
      const approvalId = `approval_${this.createRequestCalls.length}`;
      const request: ApprovalRequest = {
        approvalId,
        taskId: input.taskId,
        executionId: input.executionId ?? null,
        sourceAgentId: input.sourceAgentId,
        reason: input.reason,
        riskLevel: input.riskLevel as "low" | "medium" | "high" | "critical",
        options: input.options,
        context: input.context,
        timeoutPolicy: input.timeoutPolicy as "reject" | "approve" | "remain_pending",
        createdAt: new Date().toISOString(),
      };
      this.requests.set(approvalId, request as any);
      return request;
    },
    getApproval(approvalId: string) {
      return this.requests.get(approvalId) ?? null;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("EvolutionMvpService throws on insufficient samples in proposeBudgetAdjustment", () => {
  // This test verifies the validation in buildRecommendedBudgetPolicy is called
  const db = { transaction: (_fn: () => void) => {} } as any;
  const store = {
    evolution: {
      insertEvolutionProposal: () => {},
      insertEvolutionLog: () => {},
    },
    event: { insertEvent: () => {} },
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  assert.throws(
    () =>
      service.proposeBudgetAdjustment({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
        sampleSize: 2, // insufficient
        observedAverageCostUsd: 0.05,
        successRate: 0.9,
        proposalReason: "Test",
      }),
    /insufficient_budget_samples/,
  );
});

test("EvolutionMvpService throws on invalid success rate in proposeBudgetAdjustment", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const store = {
    evolution: {
      insertEvolutionProposal: () => {},
      insertEvolutionLog: () => {},
    },
    event: { insertEvent: () => {} },
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  assert.throws(
    () =>
      service.proposeBudgetAdjustment({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
        sampleSize: 10,
        observedAverageCostUsd: 0.05,
        successRate: 1.5, // invalid
        proposalReason: "Test",
      }),
    /invalid_success_rate/,
  );
});

test("EvolutionMvpService throws on zero observed cost in proposeBudgetAdjustment", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const store = {
    evolution: {
      insertEvolutionProposal: () => {},
      insertEvolutionLog: () => {},
    },
    event: { insertEvent: () => {} },
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  assert.throws(
    () =>
      service.proposeBudgetAdjustment({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "div-123",
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
        sampleSize: 10,
        observedAverageCostUsd: 0, // invalid
        successRate: 0.9,
        proposalReason: "Test",
      }),
    /invalid_observed_cost/,
  );
});

test("EvolutionMvpService throws on invalid scope ref in proposeBudgetAdjustment", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const store = {
    evolution: {
      insertEvolutionProposal: () => {},
      insertEvolutionLog: () => {},
    },
    event: { insertEvent: () => {} },
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  assert.throws(
    () =>
      service.proposeBudgetAdjustment({
        taskId: "task_123",
        sourceAgentId: "agent_456",
        scopeType: "division",
        scopeRef: "x", // too short
        currentPolicy: {
          maxTaskCostUsd: 0.10,
          maxDailyCostUsd: 1.0,
          maxMonthlyCostUsd: 10.0,
          warnAtRatio: 0.8,
          mode: "supervised",
        },
        sampleSize: 10,
        observedAverageCostUsd: 0.05,
        successRate: 0.9,
        proposalReason: "Test",
      }),
    /evolution\.invalid_scope_ref/,
  );
});

test("EvolutionMvpService resolveBudgetPolicy returns base policy when no active policy", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const evolutionStore = createMockEvolutionStore();
  const eventStore = createMockEventStore();
  const store = {
    evolution: {
      listEvolutionPolicies: () => [],
    },
    event: eventStore,
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  const basePolicy: BudgetPolicy = {
    maxTaskCostUsd: 0.10,
    maxDailyCostUsd: 1.0,
    maxMonthlyCostUsd: 10.0,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = service.resolveBudgetPolicy(basePolicy, "division", "div-123");

  assert.deepEqual(result.policy, basePolicy);
  assert.strictEqual(result.sourceProposalId, null);
});

test("EvolutionMvpService resolveBudgetPolicy returns active policy when exists", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const proposalId = "proposal_abc";
  const evolutionStore = createMockEvolutionStore();
  const eventStore = createMockEventStore();

  const activePolicy: EvolutionPolicyRecord = {
    id: "policy_123",
    proposalId,
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div-123",
    status: "active",
    valueJson: JSON.stringify({
      recommendedPolicy: {
        maxTaskCostUsd: 0.15,
        maxDailyCostUsd: 1.5,
        maxMonthlyCostUsd: 15.0,
        warnAtRatio: 0.85,
        mode: "supervised",
      },
      baselinePolicy: {
        maxTaskCostUsd: 0.10,
        maxDailyCostUsd: 1.0,
        maxMonthlyCostUsd: 10.0,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
    }),
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const store = {
    evolution: {
      listEvolutionPolicies: () => [activePolicy],
    },
    event: eventStore,
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  const basePolicy: BudgetPolicy = {
    maxTaskCostUsd: 0.10,
    maxDailyCostUsd: 1.0,
    maxMonthlyCostUsd: 10.0,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = service.resolveBudgetPolicy(basePolicy, "division", "div-123");

  assert.strictEqual(result.policy.maxTaskCostUsd, 0.15);
  assert.strictEqual(result.sourceProposalId, proposalId);
});

test("EvolutionMvpService listProposalViews returns empty array when no proposals", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const evolutionStore = createMockEvolutionStore();
  const eventStore = createMockEventStore();
  const store = {
    evolution: {
      listEvolutionProposals: () => [],
    },
    event: eventStore,
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  const result = service.listProposalViews();
  assert.deepEqual(result, []);
});

test("EvolutionMvpService listProposalViews returns filtered proposals by status", () => {
  const db = { transaction: (_fn: () => void) => {} } as any;
  const proposal1: EvolutionProposalRecord = {
    id: "proposal_1",
    taskId: "task_1",
    executionId: null,
    sourceAgentId: "agent_1",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div-1",
    status: "pending_approval",
    approvalId: "approval_1",
    summary: "Test 1",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };
  const proposal2: EvolutionProposalRecord = {
    id: "proposal_2",
    taskId: "task_2",
    executionId: null,
    sourceAgentId: "agent_2",
    kind: "budget_adjustment",
    scopeType: "division",
    scopeRef: "div-2",
    status: "applied",
    approvalId: "approval_2",
    summary: "Test 2",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    approvedAt: "2026-04-01T00:00:00.000Z",
    appliedAt: "2026-04-01T00:00:00.000Z",
    rolledBackAt: null,
  };

  const eventStore = createMockEventStore();
  const store = {
    evolution: {
      listEvolutionProposals: (status?: EvolutionProposalStatus) => {
        if (status === "applied") return [proposal2];
        if (status === "pending_approval") return [proposal1];
        return [proposal1, proposal2];
      },
      getEvolutionPolicyByProposal: () => null,
      listEvolutionLogsByProposal: () => [],
    },
    event: eventStore,
    approval: { getApproval: () => null },
  } as any;
  const approvalService = createMockApprovalService();
  const memoryService = {} as any;

  const service = new EvolutionMvpService(db, store, approvalService, memoryService);

  const applied = service.listProposalViews("applied");
  assert.strictEqual(applied.length, 1);
  assert.strictEqual(applied[0].proposal.id, "proposal_2");

  const pending = service.listProposalViews("pending_approval");
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].proposal.id, "proposal_1");
});
