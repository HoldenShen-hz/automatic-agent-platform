// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { BillingServiceAsync } from "../../../../src/scale-ecosystem/billing/billing-service-async.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

// Mock plan catalog for testing
const mockPlanCatalog = {
  plan_basic: {
    planId: "plan_basic",
    name: "Basic Plan",
    description: "Basic tier",
    features: ["feature_ai", "feature_basic"],
    quotas: {
      task_execution: { limitValue: 100, limitType: "soft", unitPriceUsd: 0.01, resetPolicy: "monthly" },
      token_usage: { limitValue: 10000, limitType: "hard", unitPriceUsd: 0.0001, resetPolicy: "monthly" },
    },
  },
  plan_pro: {
    planId: "plan_pro",
    name: "Pro Plan",
    description: "Professional tier",
    features: ["feature_ai", "feature_basic", "feature_pro"],
    quotas: {
      task_execution: { limitValue: 1000, limitType: "soft", unitPriceUsd: 0.005, resetPolicy: "monthly" },
      token_usage: { limitValue: 100000, limitType: "soft", unitPriceUsd: 0.00005, resetPolicy: "monthly" },
    },
  },
};

function createMockStore() {
  const accounts = new Map();
  const invoices = new Map();
  const sessions = new Map();
  const quotaCounters = new Map();
  const usageEvents = [];
  const ledgerEntries = [];
  const entitlementDecisions = [];
  const artifacts = [];

  return {
    billing: {
      getBillingAccount: (accountId) => accounts.get(accountId) || null,
      upsertBillingAccount: (record) => accounts.set(record.accountId, record),
      getBillingInvoice: (invoiceId) => invoices.get(invoiceId) || null,
      insertBillingInvoice: (record) => invoices.set(record.invoiceId, record),
      updateBillingInvoiceStatus: ({ invoiceId, status }) => {
        const invoice = invoices.get(invoiceId);
        if (invoice) {
          invoice.status = status;
        }
      },
      getBillingPaymentSession: (sessionId) => sessions.get(sessionId) || null,
      getBillingPaymentSessionByGatewayRef: (gatewayKind, gatewayRef) => {
        for (const session of sessions.values()) {
          if (session.gatewayKind === gatewayKind && session.gatewaySessionRef === gatewayRef) {
            return session;
          }
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
        if (filters.limit) result = result.slice(0, filters.limit);
        return result;
      },
      listBillingInvoicesForAccount: (accountId, limit) => {
        const result = Array.from(invoices.values()).filter(i => i.accountId === accountId);
        return limit ? result.slice(0, limit) : result;
      },
      listBillingPaymentSessionsForInvoice: (invoiceId) => {
        return Array.from(sessions.values()).filter(s => s.invoiceId === invoiceId);
      },
      getQuotaCounter: (accountId, metricType, start, end) => {
        const key = `${accountId}:${metricType}`;
        return quotaCounters.get(key) || null;
      },
      upsertQuotaCounter: (record) => {
        const key = `${record.accountId}:${record.metricType}`;
        quotaCounters.set(key, record);
      },
      listQuotaCounters: (accountId) => {
        return Array.from(quotaCounters.values()).filter(c => c.accountId === accountId);
      },
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
      insertTask: (task) => { },
    },
    artifact: {
      insertArtifact: (record) => artifacts.push(record),
    },
  };
}

function createMockDb() {
  return {
    transaction: (fn) => fn(),
    filePath: "/tmp/test.db",
  };
}

test("BillingServiceAsync createAccount returns Promise", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  const result = service.createAccount({
    ownerId: "owner_async_1",
    planId: "plan_basic",
  });

  assert.ok(result instanceof Promise);

  const account = await result;
  assert.equal(account.ownerId, "owner_async_1");
  assert.equal(account.planId, "plan_basic");
});

test("BillingServiceAsync createAccount with custom id", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  const account = await service.createAccount({
    accountId: "async_acct_custom",
    ownerId: "owner_async_2",
    planId: "plan_pro",
  });

  assert.equal(account.accountId, "async_acct_custom");
  assert.equal(account.planId, "plan_pro");
});

test("BillingServiceAsync evaluateEntitlement returns Promise", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await service.createAccount({ accountId: "acct_async_1", ownerId: "owner_async_3", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_async_1",
    featureKey: "feature_ai",
  });

  assert.ok(result instanceof Promise);

  const entitlement = await result;
  assert.equal(entitlement.decision.decisionType, "allow");
});

test("BillingServiceAsync evaluateEntitlement denies feature not in plan", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await service.createAccount({ accountId: "acct_async_2", ownerId: "owner_async_4", planId: "plan_basic" });

  const result = await service.evaluateEntitlement({
    accountId: "acct_async_2",
    featureKey: "feature_pro",
  });

  assert.equal(result.decision.decisionType, "deny");
});

test("BillingServiceAsync recordUsage returns Promise", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await service.createAccount({ accountId: "acct_async_3", ownerId: "owner_async_5", planId: "plan_basic" });

  const result = service.recordUsage({
    accountId: "acct_async_3",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  assert.ok(result instanceof Promise);

  const usageResult = await result;
  assert.ok(usageResult.usageEvent);
  assert.equal(usageResult.usageEvent.quantity, 10);
});

test("BillingServiceAsync recordUsage accumulates quota", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await service.createAccount({ accountId: "acct_async_4", ownerId: "owner_async_6", planId: "plan_basic" });

  await service.recordUsage({
    accountId: "acct_async_4",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  const result = await service.recordUsage({
    accountId: "acct_async_4",
    metricType: "task_execution",
    quantity: 5,
    source: "runtime",
  });

  assert.equal(result.quotaCounter.usedQuantity, 15);
});

test("BillingServiceAsync evaluateEntitlement with metric quota check", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await service.createAccount({ accountId: "acct_async_5", ownerId: "owner_async_7", planId: "plan_basic" });

  const result = await service.evaluateEntitlement({
    accountId: "acct_async_5",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 50,
  });

  assert.equal(result.decision.decisionType, "allow");
  assert.ok(result.remainingQuantity !== null);
  assert.ok(result.projectedQuantity !== null);
});

test("BillingServiceAsync multiple operations in sequence", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await service.createAccount({
    accountId: "acct_seq",
    ownerId: "owner_seq",
    planId: "plan_pro",
  });

  const entitlement1 = await service.evaluateEntitlement({
    accountId: "acct_seq",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 100,
  });
  assert.equal(entitlement1.decision.decisionType, "allow");

  await service.recordUsage({
    accountId: "acct_seq",
    metricType: "task_execution",
    quantity: 50,
    source: "api",
  });

  const entitlement2 = await service.evaluateEntitlement({
    accountId: "acct_seq",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 100,
  });
  assert.equal(entitlement2.decision.decisionType, "allow");
  assert.ok(entitlement2.remainingQuantity < entitlement1.remainingQuantity);
});

test("BillingServiceAsync throws for non-existent account", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  await assert.rejects(
    async () => {
      await service.evaluateEntitlement({ accountId: "nonexistent", featureKey: "feature_ai" });
    },
    /billing.account_not_found/,
  );
});

test("BillingServiceAsync createAccount with optional fields", async () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingServiceAsync(db, store, { planCatalog: mockPlanCatalog });

  const account = await service.createAccount({
    accountId: "acct_optional",
    ownerId: "owner_optional",
    workspaceId: "ws_optional",
    planId: "plan_basic",
    status: "active",
  });

  assert.equal(account.workspaceId, "ws_optional");
  assert.equal(account.status, "active");
});
