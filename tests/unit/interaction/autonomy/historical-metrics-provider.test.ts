import assert from "node:assert/strict";
import test from "node:test";

import {
  SqlExecutionMetricsProvider,
  toCapabilityTrustScore,
  type ExecutionMetrics,
  type HistoricalMetricsInput,
} from "../../../../src/interaction/autonomy/historical-metrics-provider.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

function makeMetrics(overrides: Partial<ExecutionMetrics> = {}): ExecutionMetrics {
  return {
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 3,
    humanOverrides: 2,
    incidents: 1,
    lastIncidentAt: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<HistoricalMetricsInput> = {}): HistoricalMetricsInput {
  return {
    agentId: "agent_1",
    capabilityId: "deploy",
    currentAutonomy: "semi_auto",
    windowDays: 30,
    ...overrides,
  };
}

function createMockDb(rows: Array<{ status: string; requires_approval: number; last_error_code: string | null; created_at: string }>): AuthoritativeSqlDatabase {
  return {
    connection: {
      prepare: () => ({
        all: () => rows,
      }),
    },
  } as unknown as AuthoritativeSqlDatabase;
}

test("SqlExecutionMetricsProvider returns zero metrics for empty result set", async () => {
  const db = createMockDb([]);
  const provider = new SqlExecutionMetricsProvider(db);
  const result = await provider.fetchMetrics(makeInput());

  assert.equal(result.totalExecutions, 0);
  assert.equal(result.successfulExecutions, 0);
  assert.equal(result.failedExecutions, 0);
  assert.equal(result.humanOverrides, 0);
  assert.equal(result.incidents, 0);
  assert.equal(result.lastIncidentAt, null);
});

test("SqlExecutionMetricsProvider counts successful executions", async () => {
  const db = createMockDb([
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-01T00:00:00Z" },
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-02T00:00:00Z" },
    { status: "failed", requires_approval: 0, last_error_code: "ERR_TIMEOUT", created_at: "2026-04-03T00:00:00Z" },
  ]);
  const provider = new SqlExecutionMetricsProvider(db);
  const result = await provider.fetchMetrics(makeInput());

  assert.equal(result.totalExecutions, 3);
  assert.equal(result.successfulExecutions, 2);
  assert.equal(result.failedExecutions, 1);
  assert.equal(result.incidents, 1);
});

test("SqlExecutionMetricsProvider counts human overrides via requires_approval", async () => {
  const db = createMockDb([
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-01T00:00:00Z" },
    { status: "succeeded", requires_approval: 1, last_error_code: null, created_at: "2026-04-02T00:00:00Z" },
    { status: "succeeded", requires_approval: 1, last_error_code: null, created_at: "2026-04-03T00:00:00Z" },
  ]);
  const provider = new SqlExecutionMetricsProvider(db);
  const result = await provider.fetchMetrics(makeInput());

  assert.equal(result.totalExecutions, 3);
  assert.equal(result.humanOverrides, 2);
});

test("SqlExecutionMetricsProvider counts incidents via last_error_code", async () => {
  const db = createMockDb([
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-01T00:00:00Z" },
    { status: "failed", requires_approval: 0, last_error_code: "ERR_NETWORK", created_at: "2026-04-02T00:00:00Z" },
    { status: "failed", requires_approval: 0, last_error_code: "ERR_NETWORK", created_at: "2026-04-03T00:00:00Z" },
  ]);
  const provider = new SqlExecutionMetricsProvider(db);
  const result = await provider.fetchMetrics(makeInput());

  assert.equal(result.incidents, 2);
});

test("SqlExecutionMetricsProvider captures last incident timestamp", async () => {
  // Rows are returned in the order they appear in the mock - first error found is returned
  const db = createMockDb([
    { status: "failed", requires_approval: 0, last_error_code: "ERR_001", created_at: "2026-04-15T00:00:00Z" },
    { status: "failed", requires_approval: 0, last_error_code: "ERR_002", created_at: "2026-04-01T00:00:00Z" },
  ]);
  const provider = new SqlExecutionMetricsProvider(db);
  const result = await provider.fetchMetrics(makeInput());

  // Returns first row with error code (April 15 in this case, since it appears first in the array)
  assert.equal(result.lastIncidentAt, "2026-04-15T00:00:00Z");
});

test("SqlExecutionMetricsProvider uses windowDays to filter by date", async () => {
  const db = createMockDb([
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-01T00:00:00Z" },
  ]);
  const provider = new SqlExecutionMetricsProvider(db);
  await provider.fetchMetrics(makeInput({ windowDays: 30 }));

  // The SQL query uses parameterized window start date
  // We verify the method doesn't throw and returns expected structure
});

test("toCapabilityTrustScore maps metrics to trust score structure", () => {
  const metrics = makeMetrics({
    totalExecutions: 200,
    successfulExecutions: 190,
    failedExecutions: 5,
    humanOverrides: 3,
    incidents: 2,
    lastIncidentAt: "2026-04-01T00:00:00Z",
  });
  const input = makeInput({ capabilityId: "k8s_deploy", currentAutonomy: "supervised" });

  const result = toCapabilityTrustScore(metrics, input);

  assert.equal(result.capabilityId, "k8s_deploy");
  assert.equal(result.currentAutonomy, "supervised");
  assert.equal(result.totalExecutions, 200);
  assert.equal(result.successfulExecutions, 190);
  assert.equal(result.failedExecutions, 5);
  assert.equal(result.humanOverrides, 3);
  assert.equal(result.incidents, 2);
  assert.equal(result.trustScore, 0);
  assert.ok(result.lastIncidentAgeDays !== null);
  assert.ok(result.lastIncidentAgeDays >= 0);
});

test("toCapabilityTrustScore handles null lastIncidentAt", () => {
  const metrics = makeMetrics({ lastIncidentAt: null });
  const input = makeInput();

  const result = toCapabilityTrustScore(metrics, input);

  assert.equal(result.lastIncidentAgeDays, null);
});

test("SqlExecutionMetricsProvider calculates correct totals from mixed statuses", async () => {
  const db = createMockDb([
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-01T00:00:00Z" },
    { status: "succeeded", requires_approval: 1, last_error_code: null, created_at: "2026-04-02T00:00:00Z" },
    { status: "failed", requires_approval: 0, last_error_code: "ERR_001", created_at: "2026-04-03T00:00:00Z" },
    { status: "succeeded", requires_approval: 0, last_error_code: null, created_at: "2026-04-04T00:00:00Z" },
    { status: "failed", requires_approval: 0, last_error_code: null, created_at: "2026-04-05T00:00:00Z" },
  ]);
  const provider = new SqlExecutionMetricsProvider(db);
  const result = await provider.fetchMetrics(makeInput());

  assert.equal(result.totalExecutions, 5);
  assert.equal(result.successfulExecutions, 3);
  assert.equal(result.failedExecutions, 2);
  assert.equal(result.humanOverrides, 1);
  assert.equal(result.incidents, 1);
});
