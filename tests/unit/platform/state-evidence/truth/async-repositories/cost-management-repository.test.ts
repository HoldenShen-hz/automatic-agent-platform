import assert from "node:assert/strict";
import test from "node:test";

import {
  AsyncCostManagementRepository,
  type CostReportRecord,
  type BudgetAlertRecord,
  type TokenUsageDailyRecord,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/cost-management-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(calls: SqlCall[] = []) {
  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      return { rows: [], rowCount: 0, changes: 0 };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return 1;
    },
  };
  return connection;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createCostReport(overrides: Partial<CostReportRecord> = {}): CostReportRecord {
  return {
    reportId: "report-1",
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 1234.56,
    currency: "USD",
    resourceCostsJson: '{"compute": 800, "storage": 200, "network": 234.56}',
    submittedBy: "admin",
    submittedAt: "2026-04-26T10:00:00.000Z",
    createdAt: "2026-04-26T10:00:00.000Z",
    ...overrides,
  };
}

function createBudgetAlert(overrides: Partial<BudgetAlertRecord> = {}): BudgetAlertRecord {
  return {
    alertId: "alert-1",
    tenantId: "tenant-1",
    budgetType: "monthly",
    thresholdUsd: 1000,
    currentSpendUsd: 1200,
    alertLevel: "warning",
    triggeredAt: "2026-04-20T00:00:00.000Z",
    acknowledgedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

function createTokenUsage(overrides: Partial<TokenUsageDailyRecord> = {}): TokenUsageDailyRecord {
  return {
    usageId: "usage-1",
    tenantId: "tenant-1",
    packId: "pack-1",
    date: "2026-04-25",
    modelId: "claude-3-5-sonnet",
    inputTokens: 100000,
    outputTokens: 50000,
    requestCount: 100,
    costUsd: 2.50,
    stepId: null,
    createdAt: "2026-04-25T23:59:59.999Z",
    updatedAt: "2026-04-25T23:59:59.999Z",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Reports
// ─────────────────────────────────────────────────────────────────────────────

test("insertCostReport executes correct SQL", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  const report = createCostReport();
  await repo.insertCostReport(report);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "execute");
  assert.ok(calls[0].sql.includes("INSERT INTO cost_reports"));
  assert.deepEqual(calls[0].params, [
    report.reportId,
    report.tenantId,
    report.periodStart,
    report.periodEnd,
    report.totalCostUsd,
    report.currency,
    report.resourceCostsJson,
    report.submittedBy,
    report.submittedAt,
    report.createdAt,
  ]);
});

test("getCostReport queries with correct SQL and params", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.getCostReport("report-123");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "queryOne");
  assert.ok(calls[0].sql.includes("SELECT"));
  assert.ok(calls[0].sql.includes("cost_reports"));
  assert.ok(calls[0].sql.includes("WHERE report_id = $1"));
  assert.deepEqual(calls[0].params, ["report-123"]);
});

test("listCostReportsByTenant with tenant filter", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.listCostReportsByTenant("tenant-1", 10);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "query");
  assert.ok(calls[0].sql.includes("WHERE tenant_id = $1"));
  assert.deepEqual(calls[0].params, ["tenant-1", 10]);
});

test("listCostReportsByTenant with null tenant returns all", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.listCostReportsByTenant(null, 10);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "query");
  assert.ok(calls[0].sql.includes("FROM cost_reports"));
  assert.ok(!calls[0].sql.includes("WHERE tenant_id"));
  assert.deepEqual(calls[0].params, [10]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Budget Alerts
// ─────────────────────────────────────────────────────────────────────────────

test("insertBudgetAlert executes correct SQL", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  const alert = createBudgetAlert();
  await repo.insertBudgetAlert(alert);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "execute");
  assert.ok(calls[0].sql.includes("INSERT INTO budget_alerts"));
  assert.deepEqual(calls[0].params, [
    alert.alertId,
    alert.tenantId,
    alert.budgetType,
    alert.thresholdUsd,
    alert.currentSpendUsd,
    alert.alertLevel,
    alert.triggeredAt,
    alert.acknowledgedAt,
    alert.createdAt,
    alert.updatedAt,
  ]);
});

test("updateBudgetAlert builds correct UPDATE query", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.updateBudgetAlert({
    alertId: "alert-1",
    currentSpendUsd: 1500,
    alertLevel: "critical",
    updatedAt: "2026-04-26T00:00:00.000Z",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "execute");
  assert.ok(calls[0].sql.includes("UPDATE budget_alerts SET"));
  assert.ok(calls[0].sql.includes("current_spend_usd = $2"));
  assert.ok(calls[0].sql.includes("alert_level = $3"));
  assert.ok(calls[0].sql.includes("WHERE alert_id = $"));
});

test("getBudgetAlert queries with correct SQL and params", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.getBudgetAlert("alert-123");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "queryOne");
  assert.ok(calls[0].sql.includes("budget_alerts"));
  assert.deepEqual(calls[0].params, ["alert-123"]);
});

test("listBudgetAlertsByTenant returns alerts for tenant", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.listBudgetAlertsByTenant("tenant-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "query");
  assert.ok(calls[0].sql.includes("WHERE tenant_id = $1"));
});

test("listActiveAlerts returns unacknowledged triggered alerts", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.listActiveAlerts();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "query");
  assert.ok(calls[0].sql.includes("triggered_at IS NOT NULL"));
  assert.ok(calls[0].sql.includes("acknowledged_at IS NULL"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Token Usage Daily
// ─────────────────────────────────────────────────────────────────────────────

test("upsertTokenUsageDaily executes correct SQL with ON CONFLICT", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  const usage = createTokenUsage();
  await repo.upsertTokenUsageDaily(usage);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "execute");
  assert.ok(calls[0].sql.includes("INSERT INTO token_usage_daily"));
  assert.ok(calls[0].sql.includes("ON CONFLICT"));
  assert.deepEqual(calls[0].params, [
    usage.usageId,
    usage.tenantId,
    usage.packId,
    usage.date,
    usage.modelId,
    usage.inputTokens,
    usage.outputTokens,
    usage.requestCount,
    usage.costUsd,
    usage.stepId,
    usage.createdAt,
    usage.updatedAt,
  ]);
});

test("getTokenUsageDaily queries with correct SQL and params", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.getTokenUsageDaily("usage-123");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "queryOne");
  assert.ok(calls[0].sql.includes("token_usage_daily"));
  assert.ok(calls[0].sql.includes("WHERE usage_id = $1"));
  assert.deepEqual(calls[0].params, ["usage-123"]);
});

test("listTokenUsageByTenantAndDate with tenant filter", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.listTokenUsageByTenantAndDate(
    "tenant-1",
    "2026-04-01",
    "2026-04-30",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "query");
  assert.ok(calls[0].sql.includes("WHERE tenant_id = $1"));
  assert.ok(calls[0].sql.includes("date >= $2"));
  assert.ok(calls[0].sql.includes("date <= $3"));
  assert.deepEqual(calls[0].params, ["tenant-1", "2026-04-01", "2026-04-30"]);
});

test("listTokenUsageByTenantAndDate with null tenant", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.listTokenUsageByTenantAndDate(null, "2026-04-01", "2026-04-30");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "query");
  assert.ok(calls[0].sql.includes("FROM token_usage_daily"));
  assert.ok(calls[0].sql.includes("WHERE date >= $1"));
  assert.deepEqual(calls[0].params, ["2026-04-01", "2026-04-30"]);
});

test("sumTokenCostsByTenant returns aggregated cost", async () => {
  const calls: SqlCall[] = [];
  const conn = createConnection(calls);
  const repo = new AsyncCostManagementRepository(conn);

  await repo.sumTokenCostsByTenant("tenant-1", "2026-04-01", "2026-04-30");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "queryOne");
  assert.ok(calls[0].sql.includes("SUM(cost_usd)"));
  assert.ok(calls[0].sql.includes("WHERE tenant_id = $1"));
  assert.ok(calls[0].sql.includes("date >= $2"));
  assert.ok(calls[0].sql.includes("date <= $3"));
});