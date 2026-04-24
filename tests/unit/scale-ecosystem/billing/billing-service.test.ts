// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { BillingService } from "../../../../src/scale-ecosystem/billing/billing-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type {
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  EntitlementDecisionRecord,
  LedgerEntryRecord,
  QuotaCounterRecord,
  UsageEventRecord,
} from "../../../../src/platform/contracts/types/domain.js";

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
        if (filters.gatewayKind) result = result.filter(s => s.gatewayKind === filters.gatewayKind);
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

test("BillingService creates account with valid input", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({
    ownerId: "owner_123",
    planId: "plan_basic",
  });

  assert.equal(account.ownerId, "owner_123");
  assert.equal(account.planId, "plan_basic");
  assert.equal(account.status, "active");
  assert.ok(account.accountId);
  assert.ok(account.createdAt);
});

test("BillingService creates account with custom id", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  const account = service.createAccount({
    accountId: "custom_acct_123",
    ownerId: "owner_456",
    planId: "plan_pro",
  });

  assert.equal(account.accountId, "custom_acct_123");
  assert.equal(account.planId, "plan_pro");
});

test("BillingService evaluates entitlement for valid feature", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_1", ownerId: "owner_1", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_1",
    featureKey: "feature_ai",
  });

  assert.equal(result.decision.decisionType, "allow");
  assert.equal(result.decision.featureKey, "feature_ai");
});

test("BillingService denies entitlement for feature not in plan", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_2", ownerId: "owner_2", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_2",
    featureKey: "feature_pro",
  });

  assert.equal(result.decision.decisionType, "deny");
  assert.equal(result.decision.reasonCode, "billing.feature_not_in_plan");
});

test("BillingService evaluates quota-based entitlement with available quota", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_3", ownerId: "owner_3", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_3",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 50,
  });

  assert.equal(result.decision.decisionType, "allow");
  assert.ok(result.remainingQuantity !== null);
  assert.ok(result.projectedQuantity !== null);
});

test("BillingService evaluates quota-based entitlement exceeding soft limit", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_4", ownerId: "owner_4", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_4",
    featureKey: "feature_ai",
    metricType: "task_execution",
    requestedQuantity: 150,
  });

  assert.equal(result.decision.decisionType, "warn");
});

test("BillingService evaluates quota-based entitlement exceeding hard limit", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_5", ownerId: "owner_5", planId: "plan_basic" });

  const result = service.evaluateEntitlement({
    accountId: "acct_5",
    featureKey: "feature_ai",
    metricType: "token_usage",
    requestedQuantity: 15000,
  });

  assert.equal(result.decision.decisionType, "deny");
});

test("BillingService records usage and updates quota counter", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_6", ownerId: "owner_6", planId: "plan_basic" });

  const result = service.recordUsage({
    accountId: "acct_6",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  assert.ok(result.usageEvent);
  assert.ok(result.usageEvent.usageId);
  assert.equal(result.usageEvent.quantity, 10);
  assert.ok(result.quotaCounter);
  assert.equal(result.quotaCounter.usedQuantity, 10);
  assert.ok(result.ledgerEntry);
});

test("BillingService records usage accumulates on existing counter", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_7", ownerId: "owner_7", planId: "plan_basic" });

  service.recordUsage({
    accountId: "acct_7",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  const result = service.recordUsage({
    accountId: "acct_7",
    metricType: "task_execution",
    quantity: 5,
    source: "runtime",
  });

  assert.equal(result.quotaCounter.usedQuantity, 15);
});

test("BillingService builds account summary", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_8", ownerId: "owner_8", planId: "plan_pro" });
  service.recordUsage({
    accountId: "acct_8",
    metricType: "task_execution",
    quantity: 25,
    source: "api",
  });

  const summary = service.buildAccountSummary("acct_8");

  assert.equal(summary.account.accountId, "acct_8");
  assert.equal(summary.plan.planId, "plan_pro");
  assert.equal(summary.totals.usageEventCount, 1);
  assert.ok(Array.isArray(summary.quotas));
});

test("BillingService creates invoice", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_9", ownerId: "owner_9", planId: "plan_basic" });
  service.recordUsage({
    accountId: "acct_9",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  });

  const invoice = service.createInvoice({ accountId: "acct_9" });

  assert.ok(invoice.invoiceId);
  assert.equal(invoice.accountId, "acct_9");
  assert.equal(invoice.status, "open");
  assert.ok(invoice.totalUsd > 0);
});

test("BillingService creates invoice with tax", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_10", ownerId: "owner_10", planId: "plan_basic" });
  service.recordUsage({
    accountId: "acct_10",
    metricType: "task_execution",
    quantity: 100,
    source: "api",
  });

  const invoice = service.createInvoice({ accountId: "acct_10", taxUsd: 5.50 });

  assert.equal(invoice.taxUsd, 5.50);
  assert.ok(invoice.totalUsd >= invoice.subtotalUsd + invoice.taxUsd - 0.0001);
  assert.ok(invoice.totalUsd <= invoice.subtotalUsd + invoice.taxUsd + 0.0001);
});

test("BillingService throws for non-existent account", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.evaluateEntitlement({ accountId: "nonexistent", featureKey: "feature_ai" });
  }, /billing.account_not_found/);
});

test("BillingService throws for invalid plan", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  assert.throws(() => {
    service.createAccount({ ownerId: "owner_x", planId: "nonexistent_plan" });
  }, /billing.plan_not_found/);
});

test("BillingService throws for inactive account", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({
    accountId: "acct_inactive",
    ownerId: "owner_inactive",
    planId: "plan_basic",
    status: "suspended",
  });

  assert.throws(() => {
    service.recordUsage({ accountId: "acct_inactive", metricType: "task_execution", quantity: 1, source: "api" });
  }, /billing.account_not_active/);
});

test("BillingService reconcilePaymentSession handles paid status", () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({ gatewayKind: "manual", gatewaySessionRef: "ref123", checkoutUrl: "http://test", expiresAt: null }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_recon", ownerId: "owner_recon", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_recon" });

  const session = service.createCheckoutSession({ invoiceId: invoice.invoiceId });
  const result = service.reconcilePaymentSession({
    gatewayKind: "manual",
    gatewaySessionRef: session.gatewaySessionRef,
    status: "paid",
  });

  assert.equal(result.session.status, "paid");
  assert.equal(result.invoice.status, "paid");
});

test("BillingService reconcilePaymentSession handles failed status", () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({ gatewayKind: "manual", gatewaySessionRef: "ref456", checkoutUrl: "http://test", expiresAt: null }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_fail", ownerId: "owner_fail", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_fail" });
  const session = service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  const result = service.reconcilePaymentSession({
    gatewayKind: "manual",
    gatewaySessionRef: session.gatewaySessionRef,
    status: "failed",
    failureCode: "insufficient_funds",
  });

  assert.equal(result.session.status, "failed");
  assert.equal(result.session.failureCode, "insufficient_funds");
});

test("BillingService listInvoices returns account invoices", () => {
  const store = createMockStore();
  const db = createMockDb();
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog });

  service.createAccount({ accountId: "acct_list", ownerId: "owner_list", planId: "plan_basic" });
  service.createInvoice({ accountId: "acct_list" });
  service.createInvoice({ accountId: "acct_list" });

  const invoices = service.listInvoices("acct_list");

  assert.equal(invoices.length, 2);
});

test("BillingService listPaymentSessions returns invoice sessions", () => {
  const store = createMockStore();
  const db = createMockDb();
  const mockGateway = {
    kind: "manual",
    createCheckoutSession: () => ({ gatewayKind: "manual", gatewaySessionRef: "ref789", checkoutUrl: "http://test", expiresAt: null }),
  };
  const service = new BillingService(db, store, { planCatalog: mockPlanCatalog, paymentGateway: mockGateway });

  service.createAccount({ accountId: "acct_sess", ownerId: "owner_sess", planId: "plan_basic" });
  const invoice = service.createInvoice({ accountId: "acct_sess" });
  service.createCheckoutSession({ invoiceId: invoice.invoiceId });

  const sessions = service.listPaymentSessions(invoice.invoiceId);

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].invoiceId, invoice.invoiceId);
});
