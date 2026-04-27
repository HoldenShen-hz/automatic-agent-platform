// @ts-nocheck
/**
 * Tests for billing types in scale-ecosystem/marketplace
 *
 * Verifies the input/result interfaces used by billing services.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateBillingAccountInput,
  EvaluateEntitlementInput,
  EvaluateEntitlementResult,
  RecordUsageInput,
  RecordUsageResult,
  BillingAccountSummary,
  CreateBillingInvoiceInput,
  CreateBillingCheckoutSessionInput,
  SettleBillingPaymentSessionInput,
  ReconcileBillingPaymentSessionInput,
  ReconcilePendingPaymentSessionsInput,
  ReconcilePendingPaymentSessionsResult,
  ExportBillingSummaryResult,
  BillingServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/billing/types.js";

import type {
  BillingAccountRecord,
  BillingPaymentSessionRecord,
  EntitlementDecisionRecord,
  LedgerEntryRecord,
  QuotaCounterRecord,
  UsageEventRecord,
} from "../../../../src/platform/contracts/types/domain.js";

test("BillingServiceOptions can be created with minimal config", () => {
  const options: BillingServiceOptions = {};
  assert.ok(options !== null);
  assert.ok(options !== undefined);
});

test("BillingServiceOptions accepts artifactStoreOptions", () => {
  const options: BillingServiceOptions = {
    artifactStoreOptions: {
      basePath: "/tmp/artifacts",
    },
  };
  assert.ok(options.artifactStoreOptions);
  assert.equal(options.artifactStoreOptions.basePath, "/tmp/artifacts");
});

test("BillingServiceOptions accepts planCatalog", () => {
  const options: BillingServiceOptions = {
    planCatalog: {
      plan_basic: {
        planId: "plan_basic",
        name: "Basic",
        description: "Basic plan",
        features: ["feature_ai"],
        quotas: {},
      },
    },
  };
  assert.ok(options.planCatalog);
  assert.ok(options.planCatalog["plan_basic"]);
});

test("BillingServiceOptions accepts paymentGateway", () => {
  const mockGateway = {
    kind: "stripe" as const,
    createCheckoutSession: () => ({
      gatewayKind: "stripe" as const,
      gatewaySessionRef: "cs_test_123",
      checkoutUrl: "https://checkout.stripe.com",
      expiresAt: null,
    }),
  };
  const options: BillingServiceOptions = {
    paymentGateway: mockGateway,
  };
  assert.ok(options.paymentGateway);
  assert.equal(options.paymentGateway.kind, "stripe");
});

test("CreateBillingAccountInput minimal fields", () => {
  const input: CreateBillingAccountInput = {
    ownerId: "owner_123",
    planId: "plan_basic",
  };
  assert.equal(input.ownerId, "owner_123");
  assert.equal(input.planId, "plan_basic");
  assert.equal(input.workspaceId, undefined);
  assert.equal(input.status, undefined);
});

test("CreateBillingAccountInput with all fields", () => {
  const input: CreateBillingAccountInput = {
    accountId: "acct_custom",
    ownerId: "owner_456",
    workspaceId: "ws_789",
    planId: "plan_pro",
    status: "active",
    createdAt: "2024-01-15T10:00:00.000Z",
  };
  assert.equal(input.accountId, "acct_custom");
  assert.equal(input.ownerId, "owner_456");
  assert.equal(input.workspaceId, "ws_789");
  assert.equal(input.planId, "plan_pro");
  assert.equal(input.status, "active");
  assert.equal(input.createdAt, "2024-01-15T10:00:00.000Z");
});

test("EvaluateEntitlementInput minimal fields", () => {
  const input: EvaluateEntitlementInput = {
    accountId: "acct_ent",
    featureKey: "feature_ai",
  };
  assert.equal(input.accountId, "acct_ent");
  assert.equal(input.featureKey, "feature_ai");
  assert.equal(input.metricType, undefined);
  assert.equal(input.requestedQuantity, undefined);
});

test("EvaluateEntitlementInput with all fields", () => {
  const input: EvaluateEntitlementInput = {
    accountId: "acct_ent2",
    featureKey: "feature_pro",
    metricType: "task_execution",
    requestedQuantity: 50,
    evaluatedAt: "2024-02-20T15:30:00.000Z",
  };
  assert.equal(input.accountId, "acct_ent2");
  assert.equal(input.featureKey, "feature_pro");
  assert.equal(input.metricType, "task_execution");
  assert.equal(input.requestedQuantity, 50);
  assert.equal(input.evaluatedAt, "2024-02-20T15:30:00.000Z");
});

test("RecordUsageInput minimal fields", () => {
  const input: RecordUsageInput = {
    accountId: "acct_usage",
    metricType: "task_execution",
    quantity: 10,
    source: "api",
  };
  assert.equal(input.accountId, "acct_usage");
  assert.equal(input.metricType, "task_execution");
  assert.equal(input.quantity, 10);
  assert.equal(input.source, "api");
});

test("RecordUsageInput with optional fields", () => {
  const input: RecordUsageInput = {
    accountId: "acct_usage2",
    subjectId: "subject_abc",
    workspaceId: "ws_xyz",
    tenantId: "tenant_123",
    taskId: "task_456",
    executionId: "exec_789",
    stepId: "step_001",
    metricType: "token_usage",
    quantity: 1000,
    source: "task",
    capturedAt: "2024-03-01T08:00:00.000Z",
  };
  assert.equal(input.subjectId, "subject_abc");
  assert.equal(input.workspaceId, "ws_xyz");
  assert.equal(input.tenantId, "tenant_123");
  assert.equal(input.taskId, "task_456");
  assert.equal(input.executionId, "exec_789");
  assert.equal(input.stepId, "step_001");
  assert.equal(input.metricType, "token_usage");
  assert.equal(input.capturedAt, "2024-03-01T08:00:00.000Z");
});

test("RecordUsageResult structure", () => {
  const mockUsageEvent: UsageEventRecord = {
    usageId: "usage_001",
    accountId: "acct_result",
    subjectId: "subject_test",
    workspaceId: null,
    tenantId: null,
    taskId: null,
    executionId: null,
    stepId: null,
    metricType: "api_calls",
    quantity: 5,
    source: "api",
    unitPriceUsd: 0.001,
    capturedAt: "2024-03-15T12:00:00.000Z",
  };

  const mockQuotaCounter: QuotaCounterRecord = {
    counterId: "counter_001",
    accountId: "acct_result",
    metricType: "api_calls",
    windowStart: "2024-03-01T00:00:00.000Z",
    windowEnd: "2024-03-31T23:59:59.999Z",
    usedQuantity: 105,
    limitQuantity: 1000,
    limitType: "soft",
    resetPolicy: "monthly",
    updatedAt: "2024-03-15T12:00:00.000Z",
  };

  const mockLedgerEntry: LedgerEntryRecord = {
    entryId: "ledger_001",
    accountId: "acct_result",
    usageId: "usage_001",
    periodId: "2024-03",
    entryType: "usage_charge",
    amountUsd: 0.005,
    currency: "USD",
    sourceRef: null,
    recordedAt: "2024-03-15T12:00:00.000Z",
  };

  const result: RecordUsageResult = {
    usageEvent: mockUsageEvent,
    quotaCounter: mockQuotaCounter,
    ledgerEntry: mockLedgerEntry,
  };

  assert.equal(result.usageEvent.usageId, "usage_001");
  assert.equal(result.quotaCounter?.usedQuantity, 105);
  assert.equal(result.ledgerEntry.entryType, "usage_charge");
});

test("BillingAccountSummary structure", () => {
  const mockAccount: BillingAccountRecord = {
    accountId: "acct_summary",
    ownerId: "owner_summary",
    workspaceId: null,
    planId: "plan_pro",
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockPlan = {
    planId: "plan_pro",
    name: "Pro Plan",
    description: "Professional tier",
    features: ["feature_ai", "feature_pro"],
    quotas: {
      task_execution: { limitValue: 1000, limitType: "soft" as const, unitPriceUsd: 0.005, resetPolicy: "monthly" as const },
    },
  };

  const summary: BillingAccountSummary = {
    account: mockAccount,
    plan: mockPlan,
    generatedAt: "2024-03-15T12:00:00.000Z",
    totals: {
      usageEventCount: 50,
      ledgerEntryCount: 50,
      totalBilledUsd: 25.00,
    },
    quotas: [
      {
        metricType: "task_execution",
        usedQuantity: 500,
        limitQuantity: 1000,
        remainingQuantity: 500,
        limitType: "soft",
        windowStart: "2024-03-01T00:00:00.000Z",
        windowEnd: "2024-03-31T23:59:59.999Z",
      },
    ],
    recentUsage: [],
    recentLedgerEntries: [],
    recentDecisions: [],
  };

  assert.equal(summary.account.accountId, "acct_summary");
  assert.equal(summary.plan.planId, "plan_pro");
  assert.equal(summary.totals.totalBilledUsd, 25.00);
  assert.equal(summary.quotas.length, 1);
  assert.equal(summary.quotas[0].remainingQuantity, 500);
});

test("CreateBillingInvoiceInput structure", () => {
  const input: CreateBillingInvoiceInput = {
    accountId: "acct_inv",
    tenantId: "tenant_inv",
    dueAt: "2024-04-30T23:59:59.999Z",
    taxUsd: 1.50,
    createdAt: "2024-03-31T23:59:59.999Z",
    externalInvoiceRef: "EXT-INV-001",
  };
  assert.equal(input.accountId, "acct_inv");
  assert.equal(input.tenantId, "tenant_inv");
  assert.equal(input.dueAt, "2024-04-30T23:59:59.999Z");
  assert.equal(input.taxUsd, 1.50);
  assert.equal(input.externalInvoiceRef, "EXT-INV-001");
});

test("CreateBillingCheckoutSessionInput structure", () => {
  const input: CreateBillingCheckoutSessionInput = {
    invoiceId: "inv_checkout",
    tenantId: "tenant_checkout",
    createdAt: "2024-03-20T10:00:00.000Z",
  };
  assert.equal(input.invoiceId, "inv_checkout");
  assert.equal(input.tenantId, "tenant_checkout");
  assert.equal(input.createdAt, "2024-03-20T10:00:00.000Z");
});

test("SettleBillingPaymentSessionInput structure", () => {
  const input: SettleBillingPaymentSessionInput = {
    sessionId: "session_settle",
    tenantId: "tenant_settle",
    settledAt: "2024-03-21T14:30:00.000Z",
  };
  assert.equal(input.sessionId, "session_settle");
  assert.equal(input.tenantId, "tenant_settle");
  assert.equal(input.settledAt, "2024-03-21T14:30:00.000Z");
});

test("ReconcileBillingPaymentSessionInput structure", () => {
  const input: ReconcileBillingPaymentSessionInput = {
    gatewayKind: "stripe",
    gatewaySessionRef: "cs_reconcile",
    status: "paid",
    tenantId: "tenant_recon",
    occurredAt: "2024-03-22T09:00:00.000Z",
    failureCode: null,
  };
  assert.equal(input.gatewayKind, "stripe");
  assert.equal(input.gatewaySessionRef, "cs_reconcile");
  assert.equal(input.status, "paid");
  assert.equal(input.failureCode, null);
});

test("ReconcilePendingPaymentSessionsInput structure", () => {
  const input: ReconcilePendingPaymentSessionsInput = {
    tenantId: "tenant_pending",
    gatewayKind: "paddle",
    limit: 100,
    occurredAt: "2024-03-23T08:00:00.000Z",
  };
  assert.equal(input.tenantId, "tenant_pending");
  assert.equal(input.gatewayKind, "paddle");
  assert.equal(input.limit, 100);
});

test("ReconcilePendingPaymentSessionsResult structure", () => {
  const result: ReconcilePendingPaymentSessionsResult = {
    scannedCount: 10,
    reconciledCount: 8,
    unchangedCount: 1,
    skippedCount: 1,
    results: [
      {
        sessionId: "session_001",
        invoiceId: "inv_001",
        gatewayKind: "stripe",
        previousStatus: "pending",
        nextStatus: "paid",
        changed: true,
        reason: "reconciled",
      },
      {
        sessionId: "session_002",
        invoiceId: "inv_002",
        gatewayKind: "stripe",
        previousStatus: "pending",
        nextStatus: "pending",
        changed: false,
        reason: "unchanged",
      },
    ],
  };
  assert.equal(result.scannedCount, 10);
  assert.equal(result.reconciledCount, 8);
  assert.equal(result.unchangedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].reason, "reconciled");
  assert.equal(result.results[1].reason, "unchanged");
});

test("ExportBillingSummaryResult structure", () => {
  const mockArtifactRef = {
    artifactId: "artifact_export_json",
    uri: "mem://test/export.json",
    contentType: "application/json",
  };

  const mockAccount: BillingAccountRecord = {
    accountId: "acct_export",
    ownerId: "owner_export",
    workspaceId: null,
    planId: "plan_basic",
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockPlan = {
    planId: "plan_basic",
    name: "Basic Plan",
    description: "Basic tier",
    features: ["feature_ai"],
    quotas: {},
  };

  const result: ExportBillingSummaryResult = {
    summary: {
      account: mockAccount,
      plan: mockPlan,
      generatedAt: "2024-03-15T12:00:00.000Z",
      totals: {
        usageEventCount: 0,
        ledgerEntryCount: 0,
        totalBilledUsd: 0,
      },
      quotas: [],
      recentUsage: [],
      recentLedgerEntries: [],
      recentDecisions: [],
    },
    jsonArtifact: mockArtifactRef,
    markdownArtifact: { ...mockArtifactRef, artifactId: "artifact_export_md", contentType: "text/markdown" },
  };

  assert.equal(result.summary.account.accountId, "acct_export");
  assert.equal(result.jsonArtifact.artifactId, "artifact_export_json");
  assert.equal(result.markdownArtifact.contentType, "text/markdown");
});
