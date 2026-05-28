import assert from "node:assert/strict";
import test from "node:test";
import { EvolutionRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/evolution-repository.js";

function createMockDb() {
  const runCalls: unknown[][] = [];
  return {
    db: {
      connection: {
        prepare: () => ({
          run: (...args: unknown[]) => {
            runCalls.push(args);
            return { changes: 1 };
          },
          get: () => undefined,
          all: () => [],
        }),
      },
    },
    runCalls,
  };
}

test("EvolutionRepository inserts evolution proposal", () => {
  const { db, runCalls } = createMockDb();
  const repo = new EvolutionRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const proposal = {
    id: "evo_proposal_1",
    taskId: "task_1",
    executionId: "exec_1",
    sourceAgentId: "agent_a",
    kind: "budget_increase",
    scopeType: "role",
    scopeRef: "role:planner",
    status: "pending",
    approvalId: null,
    summary: "Increase budget for complex tasks",
    proposalJson: "{\"delta_budget\":100}",
    evidenceJson: "{\"success_rate\":0.9}",
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
  };

  assert.equal(repo.insertEvolutionProposal(proposal), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(proposal.id));
  assert.ok(runCalls[0]?.includes(proposal.kind));
});

test("EvolutionRepository updates evolution proposal", () => {
  const { db, runCalls } = createMockDb();
  const repo = new EvolutionRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const proposal = {
    id: "evo_proposal_2",
    taskId: "task_1",
    executionId: "exec_1",
    sourceAgentId: "agent_a",
    kind: "budget_increase",
    scopeType: "role",
    scopeRef: "role:planner",
    status: "approved",
    approvalId: "approval_1",
    summary: "Increase budget",
    proposalJson: "{}",
    evidenceJson: "{}",
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    appliedAt: null,
    rolledBackAt: null,
  };

  assert.equal(repo.updateEvolutionProposal(proposal), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(proposal.id));
  assert.ok(runCalls[0]?.includes(proposal.status));
});

test("EvolutionRepository gets evolution proposal by id", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.getEvolutionProposal("nonexistent");
  assert.equal(result, null);
});

test("EvolutionRepository lists evolution proposals", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.listEvolutionProposals();
  assert.ok(Array.isArray(result));
});

test("EvolutionRepository lists evolution proposals by status", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.listEvolutionProposals("pending");
  assert.ok(Array.isArray(result));
});

test("EvolutionRepository inserts evolution policy", () => {
  const { db, runCalls } = createMockDb();
  const repo = new EvolutionRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const policy = {
    id: "evo_policy_1",
    proposalId: "evo_proposal_1",
    kind: "budget_increase",
    scopeType: "role",
    scopeRef: "role:planner",
    status: "active",
    valueJson: "{}",
    createdAt: now,
    updatedAt: now,
    rolledBackAt: null,
  };

  assert.equal(repo.insertEvolutionPolicy(policy), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(policy.id));
  assert.ok(runCalls[0]?.includes(policy.proposalId));
});

test("EvolutionRepository gets evolution policy by proposal", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.getEvolutionPolicyByProposal("nonexistent");
  assert.equal(result, null);
});

test("EvolutionRepository lists evolution policies with filters", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.listEvolutionPolicies({ kind: "budget_increase", status: "active" });
  assert.ok(Array.isArray(result));
});

test("EvolutionRepository inserts evolution log", () => {
  const { db, runCalls } = createMockDb();
  const repo = new EvolutionRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const log = {
    id: "evo_log_1",
    proposalId: "evo_proposal_1",
    taskId: "task_1",
    executionId: "exec_1",
    eventType: "proposal_created",
    reasonCode: "success_pattern",
    beforeStateJson: null,
    afterStateJson: "{\"status\":\"pending\"}",
    metadataJson: null,
    createdAt: now,
  };

  assert.equal(repo.insertEvolutionLog(log), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(log.id));
  assert.ok(runCalls[0]?.includes(log.eventType));
});

test("EvolutionRepository lists evolution logs by proposal", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.listEvolutionLogsByProposal("evo_proposal_1");
  assert.ok(Array.isArray(result));
});

test("EvolutionRepository inserts PMF validation report", () => {
  const { db, runCalls } = createMockDb();
  const repo = new EvolutionRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const report = {
    id: "pmf_report_1",
    profileName: "planner_v1",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.000Z",
    divisionId: "div_1",
    verdict: "pass",
    summaryJson: "{\"success_rate\":0.95}",
    reportJson: "{}",
    generatedAt: now,
  };

  assert.equal(repo.insertPmfValidationReport(report), undefined);
  assert.equal(runCalls.length, 1);
  assert.ok(runCalls[0]?.includes(report.id));
  assert.ok(runCalls[0]?.includes(report.profileName));
});

test("EvolutionRepository lists PMF validation reports", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.listPmfValidationReports(10);
  assert.ok(Array.isArray(result));
});

test("EvolutionRepository gets latest PMF validation report", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new EvolutionRepository(db);

  const result = repo.getLatestPmfValidationReport();
  assert.equal(result, null);
});
