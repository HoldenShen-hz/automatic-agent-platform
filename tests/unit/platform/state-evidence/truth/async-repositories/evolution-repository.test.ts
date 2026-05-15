import assert from "node:assert/strict";
import test from "node:test";

import { AsyncEvolutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/evolution-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-26T10:00:00.000Z";

function evolutionProposalRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").EvolutionProposalRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").EvolutionProposalRecord {
  return {
    id: "prop-1",
    taskId: "task-1",
    executionId: "exec-1",
    sourceAgentId: "agent-1",
    kind: "capability",
    scopeType: "task",
    scopeRef: "task-1",
    status: "pending",
    approvalId: null,
    summary: "Test proposal",
    proposalJson: '{"change":"test"}',
    evidenceJson: '{"evidence":"test"}',
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    appliedAt: null,
    rolledBackAt: null,
    ...overrides,
  };
}

function evolutionPolicyRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").EvolutionPolicyRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").EvolutionPolicyRecord {
  return {
    id: "policy-1",
    proposalId: "prop-1",
    kind: "capability",
    scopeType: "task",
    scopeRef: "task-1",
    status: "active",
    valueJson: '{"value":"test"}',
    createdAt: now,
    updatedAt: now,
    rolledBackAt: null,
    ...overrides,
  };
}

function evolutionLogRecord(overrides: Partial<import("../../../../../../src/platform/contracts/types/domain.js").EvolutionLogRecord> = {}): import("../../../../../../src/platform/contracts/types/domain.js").EvolutionLogRecord {
  return {
    id: "log-1",
    proposalId: "prop-1",
    taskId: "task-1",
    executionId: "exec-1",
    eventType: "proposal.created",
    reasonCode: "test",
    beforeStateJson: "{}",
    afterStateJson: "{}",
    metadataJson: "{}",
    createdAt: now,
    ...overrides,
  };
}

// ─── insertEvolutionProposal ──────────────────────────────────────────────────

test("insertEvolutionProposal executes INSERT with proposal fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEvolutionRepository(connection);

  const record = evolutionProposalRecord();
  await repo.insertEvolutionProposal(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO evolution_proposals"));
  assert.deepEqual(calls[0]!.params.slice(0, 5), [
    "prop-1",
    "task-1",
    "exec-1",
    "agent-1",
    "capability",
  ]);
});

test("insertEvolutionProposal handles all proposal kinds", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEvolutionRepository(connection);

  const kinds = ["capability", "safety", "performance", "compliance"];
  for (const kind of kinds) {
    const record = evolutionProposalRecord({ kind: kind as any });
    await repo.insertEvolutionProposal(record);
  }

  assert.equal(calls.length, 4);
});

test("insertEvolutionProposal handles all status values", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEvolutionRepository(connection);

  const statuses = ["pending", "approved", "applied", "rejected", "rolled_back"];
  for (const status of statuses) {
    const record = evolutionProposalRecord({ status: status as any });
    await repo.insertEvolutionProposal(record);
  }

  assert.equal(calls.length, 5);
});

// ─── updateEvolutionProposal ─────────────────────────────────────────────────

test("updateEvolutionProposal executes UPDATE", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEvolutionRepository(connection);

  const record = evolutionProposalRecord({ status: "approved", approvedAt: now });
  await repo.updateEvolutionProposal(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("UPDATE evolution_proposals"));
  assert.ok(calls[0]!.sql.includes("status = $1"));
  assert.ok(calls[0]!.sql.includes("WHERE id = $10"));
});

test("updateEvolutionProposal returns row count", async () => {
  const { connection } = createConnection({ executeResults: [3] });
  const repo = new AsyncEvolutionRepository(connection);

  const count = await repo.updateEvolutionProposal(evolutionProposalRecord());

  assert.equal(count, 3);
});

// ─── getEvolutionProposal ─────────────────────────────────────────────────────

test("getEvolutionProposal queries by proposal ID", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [evolutionProposalRecord()],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.getEvolutionProposal("prop-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "queryOne");
  assert.ok(calls[0]!.sql.includes("FROM evolution_proposals"));
  assert.ok(calls[0]!.sql.includes("WHERE id = $1"));
  assert.deepEqual(calls[0]!.params, ["prop-1"]);
});

test("getEvolutionProposal returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncEvolutionRepository(connection);

  const result = await repo.getEvolutionProposal("nonexistent");

  assert.equal(result, null);
});

// ─── listEvolutionProposals ───────────────────────────────────────────────────

test("listEvolutionProposals returns all proposals when no status filter", async () => {
  const records = [evolutionProposalRecord({ id: "prop-1" }), evolutionProposalRecord({ id: "prop-2" })];
  const { connection, calls } = createConnection({ queryRows: [records] });
  const repo = new AsyncEvolutionRepository(connection);

  const result = await repo.listEvolutionProposals();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(!calls[0]!.sql.includes("WHERE status"));
  assert.equal(result.length, 2);
});

test("listEvolutionProposals filters by status", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[evolutionProposalRecord({ status: "approved" })]],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionProposals("approved");

  assert.ok(calls[0]!.sql.includes("WHERE status = $1"));
  assert.deepEqual(calls[0]!.params, ["approved"]);
});

// ─── insertEvolutionPolicy ───────────────────────────────────────────────────

test("insertEvolutionPolicy executes INSERT with policy fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEvolutionRepository(connection);

  const record = evolutionPolicyRecord();
  await repo.insertEvolutionPolicy(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO evolution_policies"));
  assert.deepEqual(calls[0]!.params.slice(0, 5), [
    "policy-1",
    "prop-1",
    "capability",
    "task",
    "task-1",
  ]);
});

// ─── updateEvolutionPolicy ───────────────────────────────────────────────────

test("updateEvolutionPolicy executes UPDATE", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncEvolutionRepository(connection);

  const record = evolutionPolicyRecord({ status: "rolled_back", rolledBackAt: now });
  await repo.updateEvolutionPolicy(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("UPDATE evolution_policies"));
  assert.ok(calls[0]!.sql.includes("status = $1"));
  assert.ok(calls[0]!.sql.includes("rolled_back_at = $4"));
});

// ─── getEvolutionPolicyByProposal ────────────────────────────────────────────

test("getEvolutionPolicyByProposal queries by proposal ID", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [evolutionPolicyRecord()],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.getEvolutionPolicyByProposal("prop-1");

  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.sql.includes("WHERE proposal_id = $1"));
  assert.deepEqual(calls[0]!.params, ["prop-1"]);
});

// ─── listEvolutionPolicies ────────────────────────────────────────────────────

test("listEvolutionPolicies returns all when no filters", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[evolutionPolicyRecord()]],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionPolicies();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(!calls[0]!.sql.includes("WHERE"));
});

test("listEvolutionPolicies filters by kind", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionPolicies({ kind: "safety" });

  assert.ok(calls[0]!.sql.includes("kind = $1"));
  assert.deepEqual(calls[0]!.params, ["safety"]);
});

test("listEvolutionPolicies filters by scopeType", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionPolicies({ scopeType: "task" });

  assert.ok(calls[0]!.sql.includes("scope_type = $1"));
});

test("listEvolutionPolicies filters by scopeRef", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionPolicies({ scopeRef: "task-123" });

  assert.ok(calls[0]!.sql.includes("scope_ref = $1"));
});

test("listEvolutionPolicies filters by status", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionPolicies({ status: "active" });

  assert.ok(calls[0]!.sql.includes("status = $1"));
});

test("listEvolutionPolicies combines multiple filters", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionPolicies({ kind: "capability", scopeType: "task", status: "active" });

  assert.ok(calls[0]!.sql.includes("kind = $1"));
  assert.ok(calls[0]!.sql.includes("scope_type = $2"));
  assert.ok(calls[0]!.sql.includes("status = $3"));
  assert.ok(calls[0]!.sql.includes("AND"));
});

// ─── insertEvolutionLog ──────────────────────────────────────────────────────

test("insertEvolutionLog executes INSERT with log fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEvolutionRepository(connection);

  const record = evolutionLogRecord();
  await repo.insertEvolutionLog(record);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO evolution_logs"));
  assert.deepEqual(calls[0]!.params.slice(0, 6), [
    "log-1",
    "prop-1",
    "task-1",
    "exec-1",
    "proposal.created",
    "test",
  ]);
});

// ─── listEvolutionLogsByProposal ─────────────────────────────────────────────

test("listEvolutionLogsByProposal queries by proposal ID", async () => {
  const { connection, calls } = createConnection({
    queryRows: [[evolutionLogRecord(), evolutionLogRecord({ id: "log-2" })]],
  });
  const repo = new AsyncEvolutionRepository(connection);

  const result = await repo.listEvolutionLogsByProposal("prop-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "query");
  assert.ok(calls[0]!.sql.includes("WHERE proposal_id = $1"));
  assert.deepEqual(calls[0]!.params, ["prop-1"]);
  assert.equal(result.length, 2);
});

test("listEvolutionLogsByProposal orders by created_at ASC", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listEvolutionLogsByProposal("prop-1");

  assert.ok(calls[0]!.sql.includes("ORDER BY created_at ASC"));
});

// ─── insertPmfValidationReport ───────────────────────────────────────────────

test("insertPmfValidationReport executes INSERT with report fields", async () => {
  const { connection, calls } = createConnection();
  const repo = new AsyncEvolutionRepository(connection);

  await repo.insertPmfValidationReport({
    id: "pmf-1",
    profileName: "default",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-30T23:59:59.999Z",
    divisionId: "div-1",
    verdict: "pass",
    summaryJson: '{"summary":"test"}',
    reportJson: '{"report":"test"}',
    generatedAt: now,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "execute");
  assert.ok(calls[0]!.sql.includes("INSERT INTO pmf_validation_reports"));
  assert.deepEqual(calls[0]!.params.slice(0, 5), [
    "pmf-1",
    "default",
    "2026-04-01T00:00:00.000Z",
    "2026-04-30T23:59:59.999Z",
    "div-1",
  ]);
});

// ─── listPmfValidationReports ────────────────────────────────────────────────

test("listPmfValidationReports uses default limit 20", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listPmfValidationReports();

  assert.ok(calls[0]!.sql.includes("LIMIT $1"));
  assert.deepEqual(calls[0]!.params, [20]);
});

test("listPmfValidationReports uses custom limit", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listPmfValidationReports(50);

  assert.deepEqual(calls[0]!.params, [50]);
});

test("listPmfValidationReports orders by generated_at DESC", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listPmfValidationReports();

  assert.ok(calls[0]!.sql.includes("ORDER BY generated_at DESC"));
});

test("listPmfValidationReports clamps invalid limit to default", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listPmfValidationReports(NaN);

  assert.deepEqual(calls[0]!.params, [20]);
});

test("listPmfValidationReports clamps negative limit to minimum 1", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.listPmfValidationReports(-5);

  // Math.max(1, Math.trunc(-5)) = Math.max(1, -5) = 1
  assert.deepEqual(calls[0]!.params, [1]);
});

// ─── getLatestPmfValidationReport ────────────────────────────────────────────

test("getLatestPmfValidationReport returns latest overall when no profile", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [{
      id: "pmf-1",
      profileName: "default",
      verdict: "pass",
    }],
  });
  const repo = new AsyncEvolutionRepository(connection);

  const result = await repo.getLatestPmfValidationReport(null);

  assert.equal(calls.length, 1);
  assert.ok(!calls[0]!.sql.includes("WHERE profile_name"));
  assert.ok(result !== null);
});

test("getLatestPmfValidationReport filters by profile name when provided", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [{
      id: "pmf-1",
      profileName: "enterprise",
      verdict: "pass",
    }],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.getLatestPmfValidationReport("enterprise");

  assert.ok(calls[0]!.sql.includes("WHERE profile_name = $1"));
  assert.deepEqual(calls[0]!.params, ["enterprise"]);
});

test("getLatestPmfValidationReport returns null when no reports exist", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncEvolutionRepository(connection);

  const result = await repo.getLatestPmfValidationReport();

  assert.equal(result, null);
});

test("getLatestPmfValidationReport skips empty profile name", async () => {
  const { connection, calls } = createConnection({
    queryOneRows: [{ id: "pmf-1", profileName: "default" }],
  });
  const repo = new AsyncEvolutionRepository(connection);

  await repo.getLatestPmfValidationReport("");

  // Empty string should be treated as no filter
  assert.ok(!calls[0]!.sql.includes("WHERE profile_name"));
});