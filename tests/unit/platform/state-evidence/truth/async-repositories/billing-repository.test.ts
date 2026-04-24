import assert from "node:assert/strict";
import test from "node:test";

import { AsyncBillingRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/billing-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type {
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  CostEventRecord,
  EntitlementDecisionRecord,
  LedgerEntryRecord,
  QuotaCounterRecord,
  UsageEventRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

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

const now = "2026-04-23T10:00:00.000Z";

function costEventRecord(overrides: Partial<CostEventRecord> = {}): CostEventRecord {
  return {
    id: "cost-1",
    taskId: "task-1",
    sessionId: "session-1",
    executionId: "exec-1",
    agentId: "agent-1",
    provider: "openai",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 200,
    costUsd: 0.03,
    budgetScope: "task_execution",
    providerRequestId: "req-1",
    pricingVersion: "2024-01",
    createdAt: now,
    ...overrides,
  };
}

function billingAccountRecord(overrides: Partial<BillingAccountRecord> = {}): BillingAccountRecord {
  return {
    accountId: "acct-1",
    ownerId: "user-1",
    workspaceId: "ws-1",
    planId: "pro",
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function billingInvoiceRecord(overrides: Partial<BillingInvoiceRecord> = {}): BillingInvoiceRecord {
  return {
    invoiceId: "inv-1",
    accountId: "acct-1",
    workspaceId: "ws-1",
    tenantId: "tenant-1",
    periodId: "2024-01",
    currency: "USD",
    subtotalUsd: 100.0,
    taxUsd: 10.0,
    totalUsd: 110.0,
    status: "open",
    summaryJson: "{}",
    externalInvoiceRef: null,
    dueAt: now,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
    ...overrides,
  };
}

function billingPaymentSessionRecord(overrides: Partial<BillingPaymentSessionRecord> = {}): BillingPaymentSessionRecord {
  return {
    sessionId: "pay-session-1",
    invoiceId: "inv-1",
    accountId: "acct-1",
    gatewayKind: "stripe",
    gatewaySessionRef: "stripe-session-1",
    checkoutUrl: "https://pay.example.com/session",
    status: "pending",
    amountUsd: 110.0,
    currency: "USD",
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    settledAt: null,
    failureCode: null,
    ...overrides,
  };
}

function usageEventRecord(overrides: Partial<UsageEventRecord> = {}): UsageEventRecord {
  return {
    usageId: "usage-1",
    accountId: "acct-1",
    subjectId: "tenant-1",
    workspaceId: "ws-1",
    tenantId: "tenant-1",
    taskId: null,
    executionId: null,
    stepId: null,
    metricType: "api_calls",
    quantity: 100,
    source: "runtime",
    unitPriceUsd: 0.001,
    capturedAt: now,
    ...overrides,
  };
}

function quotaCounterRecord(overrides: Partial<QuotaCounterRecord> = {}): QuotaCounterRecord {
  return {
    counterId: "quota-1",
    accountId: "acct-1",
    metricType: "api_calls",
    windowStart: "2024-01-01T00:00:00Z",
    windowEnd: "2024-01-31T23:59:59Z",
    usedQuantity: 500,
    limitQuantity: 10000,
    limitType: "hard",
    resetPolicy: "calendar_month",
    updatedAt: now,
    ...overrides,
  };
}

function ledgerEntryRecord(overrides: Partial<LedgerEntryRecord> = {}): LedgerEntryRecord {
  return {
    entryId: "entry-1",
    accountId: "acct-1",
    usageId: "usage-1",
    periodId: "2024-01",
    entryType: "usage_charge",
    amountUsd: 0.1,
    currency: "USD",
    sourceRef: "usage:task-1",
    recordedAt: now,
    ...overrides,
  };
}

function entitlementDecisionRecord(overrides: Partial<EntitlementDecisionRecord> = {}): EntitlementDecisionRecord {
  return {
    decisionId: "entitle-1",
    accountId: "acct-1",
    featureKey: "advanced_agents",
    metricType: "concurrent_agents",
    requestedQuantity: 5,
    allowed: 1,
    decisionType: "allow",
    reasonCode: "within_limit",
    policyVersion: "2024-01",
    evaluatedAt: now,
    ...overrides,
  };
}

// === Cost Event Tests ===

test("AsyncBillingRepository insertCostEvent inserts record", async () => {
  const costEvent = costEventRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.insertCostEvent(costEvent);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO cost_events/);
});

test("AsyncBillingRepository listCostEventsByTask returns events without tenant", async () => {
  const costEvent = costEventRecord();
  const { connection, calls } = createConnection({ queryRows: [[costEvent]] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.listCostEventsByTask("task-1");

  assert.deepEqual(result, [costEvent]);
  assert.match(calls[0]!.sql, /FROM cost_events$/);
  assert.match(calls[0]!.sql, /WHERE task_id = \$1/);
  assert.doesNotMatch(calls[0]!.sql, /INNER JOIN tasks/);
});

test("AsyncBillingRepository listCostEventsByTask returns events with tenant", async () => {
  const costEvent = costEventRecord();
  const { connection, calls } = createConnection({ queryRows: [[costEvent]] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.listCostEventsByTask("task-1", "tenant-a");

  assert.deepEqual(result, [costEvent]);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
  assert.match(calls[0]!.sql, /t\.tenant_id = \$2/);
});

test("AsyncBillingRepository sumCostByTask returns sum without tenant", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ total: 1.5 }] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.sumCostByTask("task-1");

  assert.equal(result, 1.5);
  assert.match(calls[0]!.sql, /SELECT COALESCE\(SUM\(cost_usd\), 0\)/);
});

test("AsyncBillingRepository sumCostByTask returns sum with tenant", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ total: 2.5 }] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.sumCostByTask("task-1", "tenant-a");

  assert.equal(result, 2.5);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
});

test("AsyncBillingRepository sumCostByTask returns 0 when no events", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.sumCostByTask("task-missing");

  assert.equal(result, 0);
});

// === Billing Account Tests ===

test("AsyncBillingRepository upsertBillingAccount upserts record", async () => {
  const account = billingAccountRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.upsertBillingAccount(account);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO billing_accounts/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(account_id\)/);
});

test("AsyncBillingRepository getBillingAccount returns account when found", async () => {
  const account = billingAccountRecord();
  const { connection, calls } = createConnection({ queryOneRows: [account] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.getBillingAccount("acct-1");

  assert.deepEqual(result, account);
  assert.match(calls[0]!.sql, /FROM billing_accounts/);
});

test("AsyncBillingRepository getBillingAccount returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.getBillingAccount("acct-missing");

  assert.equal(result, null);
});

// === Billing Invoice Tests ===

test("AsyncBillingRepository insertBillingInvoice inserts record", async () => {
  const invoice = billingInvoiceRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.insertBillingInvoice(invoice);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO billing_invoices/);
});

test("AsyncBillingRepository updateBillingInvoiceStatus updates status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.updateBillingInvoiceStatus({
    invoiceId: "inv-1",
    status: "paid",
    updatedAt: now,
    paidAt: now,
  });

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE billing_invoices/);
});

// === Billing Payment Session Tests ===

test("AsyncBillingRepository insertBillingPaymentSession inserts record", async () => {
  const session = billingPaymentSessionRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.insertBillingPaymentSession(session);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO billing_payment_sessions/);
});

test("AsyncBillingRepository updateBillingPaymentSessionStatus updates status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.updateBillingPaymentSessionStatus({
    sessionId: "pay-session-1",
    status: "paid",
    updatedAt: now,
    settledAt: now,
  });

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE billing_payment_sessions/);
});

// === Usage Event Tests ===

test("AsyncBillingRepository insertUsageEvent inserts record", async () => {
  const event = usageEventRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.insertUsageEvent(event);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO usage_events/);
});

// === Quota Counter Tests ===

test("AsyncBillingRepository upsertQuotaCounter upserts record", async () => {
  const counter = quotaCounterRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.upsertQuotaCounter(counter);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO quota_counters/);
  assert.match(calls[0]!.sql, /ON CONFLICT/);
});

// === Ledger Entry Tests ===

test("AsyncBillingRepository insertLedgerEntry inserts record", async () => {
  const entry = ledgerEntryRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.insertLedgerEntry(entry);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO ledger_entries/);
});

// === Entitlement Decision Tests ===

test("AsyncBillingRepository insertEntitlementDecision inserts record", async () => {
  const decision = entitlementDecisionRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncBillingRepository(connection);

  await repo.insertEntitlementDecision(decision);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO entitlement_decisions/);
});

// === Execution/Tenant Count Tests ===

test("AsyncBillingRepository countActiveExecutionsByTenant returns count", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 5 }] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.countActiveExecutionsByTenant("tenant-a");

  assert.equal(result, 5);
  assert.match(calls[0]!.sql, /SELECT COUNT\(\*\) AS count FROM executions e/);
});

test("AsyncBillingRepository countQueuedTasksByTenant returns count", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 3 }] });
  const repo = new AsyncBillingRepository(connection);

  const result = await repo.countQueuedTasksByTenant("tenant-a");

  assert.equal(result, 3);
  assert.match(calls[0]!.sql, /SELECT COUNT\(\*\) AS count FROM tasks/);
});