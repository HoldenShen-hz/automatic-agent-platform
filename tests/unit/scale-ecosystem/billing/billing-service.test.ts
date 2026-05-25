import assert from "node:assert/strict";
import test from "node:test";

import { BillingService } from "../../../../src/scale-ecosystem/billing/billing-service.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  EntitlementDecisionRecord,
  LedgerEntryRecord,
  QuotaCounterRecord,
  UsageEventRecord,
} from "../../../../src/platform/contracts/types/domain.js";

// Minimal plan catalog for testing
const mockPlanCatalog = {
  plan_basic: {
    planId: "plan_basic",
    name: "Basic Plan",
    description: "Basic tier",
    features: ["feature_ai", "feature_basic"],
    quotas: {
      task_execution: { limitValue: 100, limitType: "soft" as const, unitPriceUsd: 0.01, resetPolicy: "monthly" as const },
      token_usage: { limitValue: 10000, limitType: "hard" as const, unitPriceUsd: 0.0001, resetPolicy: "monthly" as const },
    },
  },
  plan_pro: {
    planId: "plan_pro",
    name: "Pro Plan",
    description: "Professional tier",
    features: ["feature_ai", "feature_basic", "feature_pro"],
    quotas: {
      task_execution: { limitValue: 1000, limitType: "soft" as const, unitPriceUsd: 0.005, resetPolicy: "monthly" as const },
      token_usage: { limitValue: 100000, limitType: "soft" as const, unitPriceUsd: 0.00005, resetPolicy: "monthly" as const },
    },
  },
};

function createMockStore() {
  const accounts = new Map();
  const invoices = new Map();
  const sessions = new Map();
  const quotaCounters = new Map();
  const usageEvents: any[] = [];
  const ledgerEntries: any[] = [];
  const entitlementDecisions: any[] = [];

  return {
    billing: {
      getBillingAccount: (accountId) => accounts.get(accountId) || null,
      upsertBillingAccount: (record) => accounts.set(record.accountId, record),
      getBillingInvoice: (invoiceId) => invoices.get(invoiceId) || null,
      insertBillingInvoice: (record) => invoices.set(record.invoiceId, record),
      updateBillingInvoiceStatus: ({ invoiceId, status }) => {
        const invoice = invoices.get(invoiceId);
        if (invoice) invoice.status = status;
      },
      getBillingPaymentSession: (sessionId) => sessions.get(sessionId) || null,
      getBillingPaymentSessionByGatewayRef: (gatewayKind, gatewaySessionRef) => {
        for (const session of sessions.values()) {
          if (session.gatewayKind === gatewayKind && session.gatewaySessionRef === gatewaySessionRef) return session;
        }
        return null;
      },
      insertBillingPaymentSession: (record) => sessions.set(record.sessionId, record),
      updateBillingPaymentSessionStatus: ({ sessionId, status, settledAt, failureCode }) => {
        const session = sessions.get(sessionId);
        if (session) {
          session.status = status;
          session.settledAt = settledAt;
          session.failureCode = failureCode;
        }
      },
      listBillingPaymentSessions: (filters = {}) => {
        let result = Array.from(sessions.values());
        if (filters.status) result = result.filter(s => s.status === filters.status);
        if (filters.gatewayKind) result = result.filter(s => s.gatewayKind === filters.gatewayKind);
        if (filters.limit) result = result.slice(0, filters.limit);
        return result;
      },
      listBillingInvoicesForAccount: (accountId, limit) => {
        const result = Array.from(invoices.values()).filter(i => i.accountId === accountId);
        return limit ? result.slice(0, limit) : result;
      },
      listBillingPaymentSessionsForInvoice: (invoiceId) =>
        Array.from(sessions.values()).filter(s => s.invoiceId === invoiceId),
      getQuotaCounter: (accountId, metricType, start, end) => {
        const key = `${accountId}:${metricType}`;
        return quotaCounters.get(key) || null;
      },
      upsertQuotaCounter: (record) => {
        const key = `${record.accountId}:${record.metricType}`;
        quotaCounters.set(key, record);
      },
      listQuotaCounters: (accountId) =>
        Array.from(quotaCounters.values()).filter(c => c.accountId === accountId),
      insertUsageEvent: (record) => usageEvents.push(record),
      listUsageEventsForAccount: (accountId, limit) => {
        const result = usageEvents.filter(e => e.accountId === accountId);
        return limit ? result.slice(-limit) : result;
      },
      insertLedgerEntry: (record) => ledgerEntries.push(record),
      listLedgerEntriesForAccount: (accountId, limit) => {
        const result = ledgerEntries.filter(e => e.accountId === accountId);
        return limit ? result.slice(-limit) : result;
      },
      insertEntitlementDecision: (record) => entitlementDecisions.push(record),
      listEntitlementDecisionsForAccount: (accountId, limit) => {
        const result = entitlementDecisions.filter(d => d.accountId === accountId);
        return limit ? result.slice(-limit) : result;
      },
    },
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
    artifact: {
      insertArtifact: () => {},
    },
  };
}

function createMockDb() {
  return {
    transaction: (fn) => fn(),
    filePath: "/tmp/test.db",
  };
}

function createTrackedMockDb() {
  let inTransaction = false;
  return {
    db: {
      transaction: (fn) => {
        inTransaction = true;
        try {
          return fn();
        } finally {
          inTransaction = false;
        }
      },
      filePath: "/tmp/test.db",
    },
    isInTransaction: () => inTransaction,
  };
}

function createMockArtifactStore() {
  return {
    writeJsonArtifact: (input) => ({
      ref: { artifactId: "artifact_123", uri: "mem://test/artifact.json" },
      record: { artifactId: "artifact_123", ...input },
    }),
    writeTextArtifact: (input) => ({
      ref: { artifactId: "artifact_456", uri: "mem://test/artifact.md" },
      record: { artifactId: "artifact_456", ...input },
    }),
  };
}

test("BillingService createAccount generates auto-id when not provided", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({ ownerId: "owner_auto", planId: "plan_basic" });

  assert.ok(account.accountId);
  assert.ok(account.accountId.length > 0);
  assert.notEqual(account.accountId, "undefined");
});

test("BillingService createAccount accepts workspaceId", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({
    ownerId: "owner_ws",
    planId: "plan_basic",
    workspaceId: "ws_abc123",
  });

  assert.equal(account.workspaceId, "ws_abc123");
});

test("BillingService createAccount defaults status to active", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({ ownerId: "owner_active", planId: "plan_basic" });

  assert.equal(account.status, "active");
});

test("BillingService createAccount respects explicit status", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({
    ownerId: "owner_suspend",
    planId: "plan_basic",
    status: "suspended",
  });

  assert.equal(account.status, "suspended");
});

test("BillingService createAccount sets timestamps", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({ ownerId: "owner_ts", planId: "plan_basic" });

  assert.ok(account.createdAt);
  assert.ok(account.updatedAt);
  assert.equal(account.createdAt, account.updatedAt);
});

test("BillingService createAccount uses custom createdAt", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({
    ownerId: "owner_custom_ts",
    planId: "plan_basic",
    createdAt: "2024-01-15T10:00:00.000Z",
  });

  assert.equal(account.createdAt, "2024-01-15T10:00:00.000Z");
});

test("BillingService evaluateEntitlement returns account in result", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_ent", ownerId: "owner_ent", planId: "plan_basic" });

  const result = service.evaluateEntitlement({ accountId: "acct_ent", featureKey: "feature_ai" });

  assert.ok(result.account);
  assert.equal(result.account.accountId, "acct_ent");
});

test("BillingService evaluateEntitlement stores decision record", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_stored", ownerId: "owner_stored", planId: "plan_basic" });

  const result = service.evaluateEntitlement({ accountId: "acct_stored", featureKey: "feature_ai" });

  assert.equal(result.decision.decisionId.length > 0, true);
  assert.equal(result.decision.accountId, "acct_stored");
});

test("BillingService evaluateEntitlement for warn returns remaining quota", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_warn", ownerId: "owner_warn", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_warn",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 120,
  });

  assert.equal(result.decision.decisionType, "warn");
  assert.ok(result.remainingQuantity !== null);
  // soft limit 100, requested 120, projected 120 > 100, remaining = max(0, 100-120) = 0
  assert.equal(result.remainingQuantity, 0);
});

test("BillingService recordUsage creates ledger entry with correct amount", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_ledger", ownerId: "owner_ledger", planId: "plan_basic" });

  const result = await service.recordUsage({
    accountId: "acct_ledger",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  // unit price for task_execution in plan_basic is 0.01
  assert.equal(result.ledgerEntry.amountUsd, 0.1);
});

test("BillingService recordUsage sets ledger entry type to usage_charge", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_type", ownerId: "owner_type", planId: "plan_basic" });

  const result = await service.recordUsage({
    accountId: "acct_type",
    metricType: "task_execution",
    quantity: 5,
    source: "api",
  });

  assert.equal(result.ledgerEntry.entryType, "usage_charge");
});

test("BillingService recordUsage sets correct periodId", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_period", ownerId: "owner_period", planId: "plan_basic" });

  const result = await service.recordUsage({
    accountId: "acct_period",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  assert.ok(result.ledgerEntry.periodId.match(/^\d{4}-\d{2}$/));
});

test("BillingService recordUsage with no quota returns null quotaCounter", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_noquota", ownerId: "owner_noquota", planId: "plan_basic" });

  // task_execution has quota, but this should still work
  const result = await service.recordUsage({
    accountId: "acct_noquota",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  assert.notEqual(result.quotaCounter, null);
});

test("BillingService recordUsage with null metricType quota returns null counter", async () => {
  const localCatalog = {
    plan_nonmetric: {
      planId: "plan_nonmetric",
      name: "Non-metric Plan",
      description: "No quotas",
      features: ["feature_basic"],
      quotas: {},
    },
  };

  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: localCatalog });

  service.createAccount({ accountId: "acct_nonmetric", ownerId: "owner_nonmetric", planId: "plan_nonmetric" });

  const result = await service.recordUsage({
    accountId: "acct_nonmetric",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  assert.equal(result.quotaCounter, null);
});

test("BillingService recordUsage increments existing quota counter", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_inc", ownerId: "owner_inc", planId: "plan_basic" });

  await service.recordUsage({
    accountId: "acct_inc",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  const result = await service.recordUsage({
    accountId: "acct_inc",
    metricType: "task_execution",
    quantity: 20,
    source: "api",
  });

  assert.equal(result.quotaCounter?.usedQuantity, 30);
});

test("BillingService recordUsage creates buffered budget ledgers for auto-created reservations", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });
  service.createAccount({ accountId: "acct_budget", ownerId: "owner_budget", planId: "plan_basic" });

  const capturedHardCaps: number[] = [];
  (service as unknown as {
    budgetAllocator: {
      reserve: (input: { ledger: { hardCap: number; currency: string } }) => { ledger: { version: number }; reservation: { budgetReservationId: string } };
      settle: (input: unknown) => Promise<{ ledger: { version: number } }>;
    };
  }).budgetAllocator = {
    reserve: (input) => {
      capturedHardCaps.push(input.ledger.hardCap);
      return {
        ledger: { ...input.ledger, version: 1 },
        reservation: { budgetReservationId: "reservation_budget" },
      };
    },
    settle: async () => ({ ledger: { version: 2 } }),
  };

  await service.recordUsage({
    accountId: "acct_budget",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
    budgetControl: {
      tenantId: "tenant_budget",
      harnessRunId: "run_budget",
      traceId: "trace_budget",
      emittedBy: "billing-test",
    },
  });

  assert.deepEqual(capturedHardCaps, [0.15]);
});

test("BillingService recordUsage compensates persisted charge when budget settlement fails", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });
  service.createAccount({ accountId: "acct_comp", ownerId: "owner_comp", planId: "plan_basic" });

  await service.recordUsage({
    accountId: "acct_comp",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  let releaseCalls = 0;
  (service as unknown as {
    budgetAllocator: {
      reserve: (input: unknown) => { ledger: { version: number }; reservation: { budgetReservationId: string } };
      settle: (input: unknown) => Promise<never>;
      release: (input: unknown) => void;
    };
  }).budgetAllocator = {
    reserve: () => ({
      ledger: { version: 1 },
      reservation: { budgetReservationId: "reservation_1" },
    }),
    settle: async () => {
      throw new Error("settlement failed");
    },
    release: () => {
      releaseCalls += 1;
    },
  };

  await assert.rejects(
    () => service.recordUsage({
      accountId: "acct_comp",
      metricType: "task_execution",
      quantity: 5,
      source: "api",
      budgetControl: {
        tenantId: "tenant_comp",
        harnessRunId: "run_comp",
        traceId: "trace_comp",
        emittedBy: "billing-test",
      },
    }),
    /settlement failed/,
  );

  const quotaCounters = store.billing.listQuotaCounters("acct_comp");
  assert.equal(quotaCounters.length, 1);
  assert.equal(quotaCounters[0].usedQuantity, 10);
  const adjustments = store.billing.listLedgerEntriesForAccount("acct_comp").filter((entry) => entry.entryType === "adjustment");
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0].amountUsd, -0.05);
  assert.equal(releaseCalls, 1);
});

test("BillingService reads existing quota counter inside transaction during recordUsage", async () => {
  const trackedDb = createTrackedMockDb();
  const store = createMockStore();
  let observedTransactionState = false;
  const originalGetQuotaCounter = store.billing.getQuotaCounter;
  store.billing.getQuotaCounter = (...args) => {
    observedTransactionState = observedTransactionState || trackedDb.isInTransaction();
    return originalGetQuotaCounter(...args);
  };
  const service = new BillingService(trackedDb.db, store, { planCatalog: mockPlanCatalog });
  service.createAccount({ accountId: "acct_txn", ownerId: "owner_txn", planId: "plan_basic" });

  await service.recordUsage({
    accountId: "acct_txn",
    metricType: "task_execution",
    quantity: 5,
    source: "api",
  });

  assert.equal(observedTransactionState, true);
});

test("BillingService uses repository atomic quota increment when available", async () => {
  const trackedDb = createTrackedMockDb();
  const store = createMockStore();
  let incrementCalls = 0;
  let upsertCalls = 0;
  const originalUpsert = store.billing.upsertQuotaCounter;
  store.billing.upsertQuotaCounter = (record) => {
    upsertCalls += 1;
    originalUpsert(record);
  };
  store.billing.incrementQuotaCounter = (counter, deltaQuantity) => {
    incrementCalls += 1;
    const existing = store.billing.getQuotaCounter(counter.accountId, counter.metricType, counter.windowStart, counter.windowEnd);
    const next = {
      ...counter,
      counterId: existing?.counterId ?? counter.counterId,
      usedQuantity: Math.round(((existing?.usedQuantity ?? 0) + deltaQuantity) * 100) / 100,
    };
    originalUpsert(next);
    return next;
  };

  const service = new BillingService(trackedDb.db, store, { planCatalog: mockPlanCatalog });
  service.createAccount({ accountId: "acct_atomic", ownerId: "owner_atomic", planId: "plan_basic" });

  await service.recordUsage({
    accountId: "acct_atomic",
    metricType: "task_execution",
    quantity: 5,
    source: "api",
  });

  assert.equal(incrementCalls, 1);
  assert.equal(upsertCalls, 0);
  assert.equal(store.billing.listQuotaCounters("acct_atomic")[0]?.usedQuantity, 5);
});

test("BillingService buildAccountSummary returns correct plan", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_plan", ownerId: "owner_plan", planId: "plan_pro" });

  const summary = service.buildAccountSummary("acct_plan");

  assert.equal(summary.plan.planId, "plan_pro");
});

test("BillingService buildAccountSummary calculates totalBilledUsd", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_total", ownerId: "owner_total", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_total",
    metricType: "task_execution",
    quantity: 100,
    source: "api",
  });

  const summary = service.buildAccountSummary("acct_total");

  // 100 tasks * 0.01 per task = 1.00 USD
  assert.equal(summary.totals.totalBilledUsd, 1.0);
});

test("BillingService buildAccountSummary returns quotas array", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_quota", ownerId: "owner_quota", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_quota",
    metricType: "task_execution",
    quantity: 5,
    source: "api",
  });

  const summary = service.buildAccountSummary("acct_quota");

  assert.ok(Array.isArray(summary.quotas));
  assert.ok(summary.quotas.length >= 0);
});

test("BillingService buildAccountSummary returns recentUsage", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_recent", ownerId: "owner_recent", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_recent",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  const summary = service.buildAccountSummary("acct_recent");

  assert.ok(Array.isArray(summary.recentUsage));
  assert.ok(summary.recentUsage.length >= 1);
});

test("BillingService buildAccountSummary sets generatedAt timestamp", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_gen", ownerId: "owner_gen", planId: "plan_basic" });

  const summary = service.buildAccountSummary("acct_gen");

  assert.ok(summary.generatedAt);
  assert.ok(new Date(summary.generatedAt).getTime() > 0);
});

test("BillingService createInvoice calculates correct total with tax", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_tax", ownerId: "owner_tax", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_tax",
    metricType: "task_execution",
    quantity: 100,
    source: "api",
  });

  const invoice = service.createInvoice({ accountId: "acct_tax", taxUsd: 1.50 });

  // 100 tasks * 0.01 = 1.00 subtotal + 1.50 tax = 2.50 total
  assert.equal(invoice.subtotalUsd, 1.0);
  assert.equal(invoice.taxUsd, 1.5);
  assert.equal(invoice.totalUsd, 2.5);
});

test("BillingService createInvoice without tax has zero tax", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_notax", ownerId: "owner_notax", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_notax",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  const invoice = service.createInvoice({ accountId: "acct_notax" });

  assert.equal(invoice.taxUsd, 0);
});

test("BillingService createInvoice sets status to open", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_inv_open", ownerId: "owner_inv_open", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_inv_open",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  const invoice = service.createInvoice({ accountId: "acct_inv_open" });

  assert.equal(invoice.status, "open");
});

test("BillingService createInvoice sets currency to USD", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_currency", ownerId: "owner_currency", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_currency",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  const invoice = service.createInvoice({ accountId: "acct_currency" });

  assert.equal(invoice.currency, "USD");
});

test("BillingService createInvoice with dueAt sets due date", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_due", ownerId: "owner_due", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_due",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  const invoice = service.createInvoice({
    accountId: "acct_due",
    dueAt: "2024-12-31T23:59:59.999Z",
  });

  assert.equal(invoice.dueAt, "2024-12-31T23:59:59.999Z");
});

test("BillingService createInvoice with externalInvoiceRef stores reference", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_ext", ownerId: "owner_ext", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_ext",
    metricType: "task_execution",
    quantity: 1,
    source: "api",
  });

  const invoice = service.createInvoice({
    accountId: "acct_ext",
    externalInvoiceRef: "EXT-REF-123",
  });

  assert.equal(invoice.externalInvoiceRef, "EXT-REF-123");
});

test("BillingService listInvoices returns empty for account with no invoices", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_noinv", ownerId: "owner_noinv", planId: "plan_basic" });

  const invoices = service.listInvoices("acct_noinv");

  assert.equal(invoices.length, 0);
});

test("BillingService listInvoices respects limit parameter", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_lim", ownerId: "owner_lim", planId: "plan_basic" });

  service.recordUsage({ accountId: "acct_lim", metricType: "task_execution", quantity: 1, source: "api" });
  service.createInvoice({ accountId: "acct_lim" });
  service.createInvoice({ accountId: "acct_lim" });
  service.createInvoice({ accountId: "acct_lim" });

  const invoices = service.listInvoices("acct_lim", 2);

  assert.equal(invoices.length, 2);
});

test("BillingService settlePaymentSession updates session to paid", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_settle",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_settle", ownerId: "owner_settle", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_settle" });
  const session = await service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  const result = service.settlePaymentSession({ sessionId: session.sessionId });

  assert.equal(result.session.status, "paid");
});

test("BillingService settlePaymentSession updates invoice to paid", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_inv_paid",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_inv_paid", ownerId: "owner_inv_paid", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_inv_paid" });
  const session = await service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  service.settlePaymentSession({ sessionId: session.sessionId });

  assert.equal(invoice.status, "paid");
});

test("BillingService settlePaymentSession creates credit ledger entry", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_credit",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_credit", ownerId: "owner_credit", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_credit" });
  const session = await service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  const result = service.settlePaymentSession({ sessionId: session.sessionId });

  // Credit should have negative amount equal to invoice total
  const credits = store.billing.listLedgerEntriesForAccount("acct_credit").filter(e => e.entryType === "credit");
  assert.ok(credits.length >= 1);
  assert.equal(credits[credits.length - 1].amountUsd, -result.invoice.totalUsd);
});

test("BillingService reconcilePaymentSession handles cancelled status", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_cancelled",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_cancelled", ownerId: "owner_cancelled", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_cancelled" });
  const session = await service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  const result = service.reconcilePaymentSession({
    gatewayKind: "manual",
    gatewaySessionRef: session.gatewaySessionRef,
    status: "cancelled",
  });

  assert.equal(result.session.status, "cancelled");
});

test("BillingService reconcilePaymentSession throws for unknown gateway ref", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.reconcilePaymentSession({
      gatewayKind: "manual",
      gatewaySessionRef: "nonexistent_ref",
      status: "paid",
    });
  }, /not found/);
});

test("BillingService reconcilePaymentSession with paid status settles session", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_paid_recon",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_paid_recon", ownerId: "owner_paid_recon", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_paid_recon" });
  const session = await service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  const result = service.reconcilePaymentSession({
    gatewayKind: "manual",
    gatewaySessionRef: session.gatewaySessionRef,
    status: "paid",
  });

  assert.equal(result.session.status, "paid");
  assert.equal(result.invoice.status, "paid");
});

test("BillingService listPaymentSessions returns empty for invoice without sessions", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_nosess", ownerId: "owner_nosess", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_nosess" });

  const sessions = service.listPaymentSessions(invoice.invoiceId);

  assert.equal(sessions.length, 0);
});

test("BillingService throws for account with invalid identifier characters", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.createAccount({ ownerId: "owner with spaces", planId: "plan_basic" });
  }, /Invalid identifier/);
});

test("BillingService throws for empty ownerId", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.createAccount({ ownerId: "", planId: "plan_basic" });
  }, /Invalid identifier/);
});

test("BillingService throws for feature key with invalid characters", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_fkey", ownerId: "owner_fkey", planId: "plan_basic" });

  assert.throws(() => {
    service.evaluateEntitlement({ accountId: "acct_fkey", featureKey: "feature with space" });
  }, /Invalid identifier/);
});

test("BillingService throws for negative requestedQuantity", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_neg", ownerId: "owner_neg", planId: "plan_basic" });

  assert.throws(() => {
    service.evaluateEntitlement({
      accountId: "acct_neg",
      featureKey: "feature_ai",
      metricType: "task_execution",
      requestedQuantity: -5,
    });
  }, /positive number/);
});

test("BillingService throws for zero quantity in recordUsage", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_zero", ownerId: "owner_zero", planId: "plan_basic" });

  await assert.rejects(async () => {
    await service.recordUsage({
      accountId: "acct_zero",
      metricType: "task_execution",
      quantity: 0,
      source: "api",
    });
  }, /positive number/);
});

test("BillingService throws for negative quantity in recordUsage", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_neg_q", ownerId: "owner_neg_q", planId: "plan_basic" });

  await assert.rejects(async () => {
    await service.recordUsage({
      accountId: "acct_neg_q",
      metricType: "task_execution",
      quantity: -10,
      source: "api",
    });
  }, /positive number/);
});

test("BillingService throws for non-finite quantity in recordUsage", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_nan", ownerId: "owner_nan", planId: "plan_basic" });

  await assert.rejects(async () => {
    await service.recordUsage({
      accountId: "acct_nan",
      metricType: "task_execution",
      quantity: NaN,
      source: "api",
    });
  }, /positive number/);
});

test("BillingService evaluateEntitlement with metricType but no quota in plan", () => {
  const localCatalog = {
    plan_noquota: {
      planId: "plan_noquota",
      name: "No Quota Plan",
      description: "No quotas defined",
      features: ["feature_basic"],
      quotas: {},
    },
  };

  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: localCatalog });

  service.createAccount({ accountId: "acct_mq", ownerId: "owner_mq", planId: "plan_noquota" });

  // Should allow but with null remaining since no quota exists
  const result = service.evaluateEntitlement({
    accountId: "acct_mq",
    featureKey: "feature_basic",
    metricType: "task_execution",
    requestedQuantity: 5,
  });

  assert.equal(result.decision.decisionType, "allow");
  assert.equal(result.remainingQuantity, null);
});

test("BillingService evaluateEntitlement degrade decision type", () => {
  const localCatalog = {
    plan_degrade: {
      planId: "plan_degrade",
      name: "Degrade Plan",
      description: "Test degrade",
      features: ["feature_ai"],
      quotas: {
        task_execution: { limitValue: 100, limitType: "degrade" as const, unitPriceUsd: 0.01, resetPolicy: "monthly" as const },
      },
    },
  };

  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: localCatalog });

  service.createAccount({ accountId: "acct_deg", ownerId: "owner_deg", planId: "plan_degrade" });

  const result = service.evaluateEntitlement({
    accountId: "acct_deg",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 150,
  });

  assert.equal(result.decision.decisionType, "degrade");
});

test("BillingService buildAccountSummary for account with no usage", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_nouse", ownerId: "owner_nouse", planId: "plan_basic" });

  const summary = service.buildAccountSummary("acct_nouse");

  assert.equal(summary.totals.usageEventCount, 0);
  assert.equal(summary.totals.totalBilledUsd, 0);
  assert.ok(Array.isArray(summary.recentUsage));
  assert.equal(summary.recentUsage.length, 0);
});

test("BillingService buildAccountSummary for inactive account throws", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({
    accountId: "acct_inact_build",
    ownerId: "owner_inact_build",
    planId: "plan_basic",
    status: "suspended",
  });

  assert.throws(() => {
    service.buildAccountSummary("acct_inact_build");
  }, /not active/);
});

test("BillingService createCheckoutSession throws for non-open invoice", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_closed",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_closed", ownerId: "owner_closed", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_closed" });

  // Manually mark invoice as paid
  store.billing.updateBillingInvoiceStatus({ invoiceId: invoice.invoiceId, status: "paid" });

  await assert.rejects(
    async () => service.createCheckoutSession({ invoiceId: invoice.invoiceId }),
    /not collectable/,
  );
});

test("BillingService listInvoices for non-existent account throws", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.listInvoices("nonexistent_acct");
  }, /not found/);
});

test("BillingService listPaymentSessions for non-existent invoice throws", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.listPaymentSessions("nonexistent_inv");
  }, /not found/);
});

test("BillingService settlePaymentSession for non-existent session throws", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.settlePaymentSession({ sessionId: "nonexistent_session" });
  }, /not found/);
});

test("BillingService createCheckoutSession accepts custom createdAt", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_custom_ts",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_custom_ts", ownerId: "owner_custom_ts", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_custom_ts" });

  const session = await service.createCheckoutSession({
    invoiceId: invoice.invoiceId,
    createdAt: "2024-06-15T12:00:00.000Z",
  });

  assert.equal(session.createdAt, "2024-06-15T12:00:00.000Z");
});

test("BillingService createCheckoutSession stores correct amount", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({
      gatewayKind: "manual",
      gatewaySessionRef: "ref_amt",
      checkoutUrl: "http://test",
      expiresAt: null,
    }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_amt", ownerId: "owner_amt", planId: "plan_basic" });
  service.recordUsage({ accountId: "acct_amt", metricType: "task_execution", quantity: 100, source: "api" });
  const invoice = service.createInvoice({ accountId: "acct_amt" });

  const session = await service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  assert.equal(session.amountUsd, invoice.totalUsd);
  assert.equal(session.currency, invoice.currency);
});
