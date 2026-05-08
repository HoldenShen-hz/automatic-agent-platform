import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { BillingRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/billing-repository.js";
import { TaskRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";

function createTestTask(
  taskRepo: TaskRepository,
  taskId: string,
  now: string,
  tenantId: string | null = null,
  status = "in_progress",
): void {
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId,
    title: `Task ${taskId}`,
    status,
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

function insertBillingFixture(repo: BillingRepository, now: string, tenantId: string = "tenant-billing-sqlite"): void {
  repo.upsertBillingAccount({
    accountId: "sqlite-acct-001",
    ownerId: "owner-001",
    workspaceId: "workspace-001",
    planId: "plan-pro",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  repo.insertBillingInvoice({
    invoiceId: "sqlite-inv-001",
    accountId: "sqlite-acct-001",
    workspaceId: "workspace-001",
    tenantId,
    periodId: "2026-04",
    currency: "USD",
    subtotalUsd: 10,
    taxUsd: 1,
    totalUsd: 11,
    status: "open",
    summaryJson: '{"lines":1}',
    externalInvoiceRef: null,
    dueAt: "2026-04-30T00:00:00.000Z",
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  });

  repo.insertBillingPaymentSession({
    sessionId: "sqlite-pay-001",
    invoiceId: "sqlite-inv-001",
    accountId: "sqlite-acct-001",
    gatewayKind: "stripe",
    gatewaySessionRef: "stripe-ref-sqlite-001",
    checkoutUrl: "https://payments.example/checkout/pay-001",
    status: "pending",
    amountUsd: 11,
    currency: "USD",
    expiresAt: "2026-04-14T12:00:00.000Z",
    createdAt: now,
    updatedAt: now,
    settledAt: null,
    failureCode: null,
  });
}

test("BillingRepository insertCostEvent and listCostEventsByTask round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-cost-task-1", now, "tenant-cost-sqlite");

    repo.insertCostEvent({
      id: "sqlite-cost-001",
      taskId: "sqlite-cost-task-1",
      sessionId: null,
      executionId: null,
      agentId: "agent-1",
      provider: "openai",
      model: "gpt-5.4",
      inputTokens: 100,
      outputTokens: 40,
      costUsd: 0.12,
      budgetScope: "task_execution",
      providerRequestId: null,
      pricingVersion: "2026-04",
      createdAt: now,
    });

    const costs = repo.listCostEventsByTask("sqlite-cost-task-1", "tenant-cost-sqlite");
    assert.equal(costs.length, 1);
    assert.equal(costs[0]?.id, "sqlite-cost-001");
    assert.equal(costs[0]?.provider, "openai");
    assert.equal(costs[0]?.costUsd, 0.12);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository sumCostByTask aggregates correctly", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-sum-task", now, "tenant-sum-sqlite");

    repo.insertCostEvent({
      id: "sqlite-sum-cost-1",
      taskId: "sqlite-sum-task",
      sessionId: null,
      executionId: null,
      agentId: "agent-1",
      provider: "openai",
      model: "gpt-5.4",
      inputTokens: 100,
      outputTokens: 40,
      costUsd: 0.10,
      budgetScope: "task_execution",
      providerRequestId: null,
      pricingVersion: "2026-04",
      createdAt: now,
    });
    repo.insertCostEvent({
      id: "sqlite-sum-cost-2",
      taskId: "sqlite-sum-task",
      sessionId: null,
      executionId: null,
      agentId: "agent-1",
      provider: "openai",
      model: "gpt-5.4",
      inputTokens: 200,
      outputTokens: 80,
      costUsd: 0.25,
      budgetScope: "task_execution",
      providerRequestId: null,
      pricingVersion: "2026-04",
      createdAt: now,
    });

    const total = repo.sumCostByTask("sqlite-sum-task", "tenant-sum-sqlite");
    assert.equal(total, 0.35, "should sum cost events correctly");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository upsertBillingAccount and getBillingAccount round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    repo.upsertBillingAccount({
      accountId: "sqlite-acct-upsert",
      ownerId: "owner-upsert",
      workspaceId: "workspace-upsert",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const account = repo.getBillingAccount("sqlite-acct-upsert");
    assert.ok(account);
    assert.equal(account?.accountId, "sqlite-acct-upsert");
    assert.equal(account?.ownerId, "owner-upsert");
    assert.equal(account?.planId, "plan-basic");
    assert.equal(account?.status, "active");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository listBillingAccounts returns all accounts", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    repo.upsertBillingAccount({
      accountId: "sqlite-list-acct-1",
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      planId: "plan-pro",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    repo.upsertBillingAccount({
      accountId: "sqlite-list-acct-2",
      ownerId: "owner-2",
      workspaceId: "workspace-2",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const accounts = repo.listBillingAccounts();
    assert.equal(accounts.length, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository insertBillingInvoice and getBillingInvoice round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-acct-inv",
      ownerId: "owner-inv",
      workspaceId: "workspace-inv",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    repo.insertBillingInvoice({
      invoiceId: "sqlite-invoice-001",
      accountId: "sqlite-acct-inv",
      workspaceId: "workspace-inv",
      tenantId: "tenant-inv",
      periodId: "2026-04",
      currency: "USD",
      subtotalUsd: 50,
      taxUsd: 5,
      totalUsd: 55,
      status: "open",
      summaryJson: '{"lines":2}',
      externalInvoiceRef: null,
      dueAt: "2026-04-30T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });

    const invoice = repo.getBillingInvoice("sqlite-invoice-001", "tenant-inv");
    assert.ok(invoice);
    assert.equal(invoice?.invoiceId, "sqlite-invoice-001");
    assert.equal(invoice?.totalUsd, 55);
    assert.equal(invoice?.status, "open");
    assert.equal(invoice?.tenantId, "tenant-inv");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository updateBillingInvoiceStatus updates status and timestamps", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const paidAt = "2026-04-27T12:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-acct-update",
      ownerId: "owner-update",
      workspaceId: "workspace-update",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    repo.insertBillingInvoice({
      invoiceId: "sqlite-inv-update",
      accountId: "sqlite-acct-update",
      workspaceId: "workspace-update",
      tenantId: "tenant-update",
      periodId: "2026-04",
      currency: "USD",
      subtotalUsd: 25,
      taxUsd: 2.5,
      totalUsd: 27.5,
      status: "open",
      summaryJson: "{}",
      externalInvoiceRef: null,
      dueAt: "2026-04-30T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });

    repo.updateBillingInvoiceStatus({
      invoiceId: "sqlite-inv-update",
      status: "paid",
      updatedAt: paidAt,
      paidAt,
      externalInvoiceRef: "stripe-inv-123",
    });

    const updated = repo.getBillingInvoice("sqlite-inv-update", "tenant-update");
    assert.equal(updated?.status, "paid");
    assert.equal(updated?.paidAt, paidAt);
    assert.equal(updated?.externalInvoiceRef, "stripe-inv-123");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository insertBillingPaymentSession and getBillingPaymentSession round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account and invoice first (required by FK constraints)
    repo.upsertBillingAccount({
      accountId: "sqlite-acct-pay",
      ownerId: "owner-pay",
      workspaceId: "workspace-pay",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    repo.insertBillingInvoice({
      invoiceId: "sqlite-inv-pay",
      accountId: "sqlite-acct-pay",
      workspaceId: "workspace-pay",
      tenantId: "tenant-pay",
      periodId: "2026-04",
      currency: "USD",
      subtotalUsd: 50,
      taxUsd: 5,
      totalUsd: 55,
      status: "open",
      summaryJson: "{}",
      externalInvoiceRef: null,
      dueAt: "2026-04-30T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });

    repo.insertBillingPaymentSession({
      sessionId: "sqlite-pay-session-001",
      invoiceId: "sqlite-inv-pay",
      accountId: "sqlite-acct-pay",
      gatewayKind: "stripe",
      gatewaySessionRef: "stripe-ref-pay-001",
      checkoutUrl: "https://checkout.example/pay-001",
      status: "pending",
      amountUsd: 50,
      currency: "USD",
      expiresAt: "2026-04-28T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      settledAt: null,
      failureCode: null,
    });

    const session = repo.getBillingPaymentSession("sqlite-pay-session-001", null);
    assert.ok(session);
    assert.equal(session?.sessionId, "sqlite-pay-session-001");
    assert.equal(session?.gatewayKind, "stripe");
    assert.equal(session?.status, "pending");
    assert.equal(session?.amountUsd, 50);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository updateBillingPaymentSessionStatus updates status and settled info", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const settledAt = "2026-04-27T12:30:00.000Z";

    // Create billing account and invoice first (required by FK constraints)
    repo.upsertBillingAccount({
      accountId: "sqlite-acct-status",
      ownerId: "owner-status",
      workspaceId: "workspace-status",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    repo.insertBillingInvoice({
      invoiceId: "sqlite-inv-status",
      accountId: "sqlite-acct-status",
      workspaceId: "workspace-status",
      tenantId: "tenant-status",
      periodId: "2026-04",
      currency: "USD",
      subtotalUsd: 75,
      taxUsd: 7.5,
      totalUsd: 82.5,
      status: "open",
      summaryJson: "{}",
      externalInvoiceRef: null,
      dueAt: "2026-04-30T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });

    repo.insertBillingPaymentSession({
      sessionId: "sqlite-pay-status-update",
      invoiceId: "sqlite-inv-status",
      accountId: "sqlite-acct-status",
      gatewayKind: "stripe",
      gatewaySessionRef: "stripe-ref-status",
      checkoutUrl: "https://checkout.example/status",
      status: "pending",
      amountUsd: 75,
      currency: "USD",
      expiresAt: "2026-04-28T10:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      settledAt: null,
      failureCode: null,
    });

    repo.updateBillingPaymentSessionStatus({
      sessionId: "sqlite-pay-status-update",
      status: "paid",
      updatedAt: settledAt,
      settledAt,
    });

    const updated = repo.getBillingPaymentSession("sqlite-pay-status-update", null);
    assert.equal(updated?.status, "paid");
    assert.equal(updated?.settledAt, settledAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository getBillingPaymentSessionByGatewayRef finds session by gateway reference", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account and invoice first (required by FK constraints)
    repo.upsertBillingAccount({
      accountId: "sqlite-acct-gateway",
      ownerId: "owner-gateway",
      workspaceId: "workspace-gateway",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    repo.insertBillingInvoice({
      invoiceId: "sqlite-inv-gateway",
      accountId: "sqlite-acct-gateway",
      workspaceId: "workspace-gateway",
      tenantId: "tenant-gateway",
      periodId: "2026-04",
      currency: "USD",
      subtotalUsd: 100,
      taxUsd: 10,
      totalUsd: 110,
      status: "open",
      summaryJson: "{}",
      externalInvoiceRef: null,
      dueAt: "2026-04-30T00:00:00.000Z",
      createdAt: now,
      updatedAt: now,
      paidAt: null,
    });

    repo.insertBillingPaymentSession({
      sessionId: "sqlite-gateway-ref-session",
      invoiceId: "sqlite-inv-gateway",
      accountId: "sqlite-acct-gateway",
      gatewayKind: "stripe",
      gatewaySessionRef: "stripe-gateway-ref-xyz",
      checkoutUrl: "https://checkout.example/gateway",
      status: "pending",
      amountUsd: 100,
      currency: "USD",
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
      settledAt: null,
      failureCode: null,
    });

    const session = repo.getBillingPaymentSessionByGatewayRef("stripe", "stripe-gateway-ref-xyz", null);
    assert.ok(session);
    assert.equal(session?.sessionId, "sqlite-gateway-ref-session");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository insertUsageEvent and listUsageEventsForAccount round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-usage-acct",
      ownerId: "owner-usage",
      workspaceId: "workspace-usage",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    repo.insertUsageEvent({
      usageId: "sqlite-usage-001",
      accountId: "sqlite-usage-acct",
      subjectId: "subject-001",
      workspaceId: "workspace-usage",
      tenantId: "tenant-usage",
      taskId: null,
      executionId: null,
      stepId: null,
      metricType: "task_execution",
      quantity: 5,
      source: "runtime",
      unitPriceUsd: 0.5,
      capturedAt: now,
    });

    const usageEvents = repo.listUsageEventsForAccount("sqlite-usage-acct");
    assert.equal(usageEvents.length, 1);
    assert.equal(usageEvents[0]?.usageId, "sqlite-usage-001");
    assert.equal(usageEvents[0]?.metricType, "task_execution");
    assert.equal(usageEvents[0]?.quantity, 5);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository upsertQuotaCounter and getQuotaCounter round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-quota-acct",
      ownerId: "owner-quota",
      workspaceId: "workspace-quota",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertQuotaCounter({
      counterId: "sqlite-quota-001",
      accountId: "sqlite-quota-acct",
      metricType: "task_execution",
      windowStart: "2026-04-01T00:00:00.000Z",
      windowEnd: "2026-05-01T00:00:00.000Z",
      usedQuantity: 25,
      limitQuantity: 100,
      limitType: "hard",
      resetPolicy: "calendar_month",
      updatedAt: now,
    });

    const counter = repo.getQuotaCounter(
      "sqlite-quota-acct",
      "task_execution",
      "2026-04-01T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z",
    );

    assert.ok(counter);
    assert.equal(counter?.counterId, "sqlite-quota-001");
    assert.equal(counter?.usedQuantity, 25);
    assert.equal(counter?.limitQuantity, 100);
    assert.equal(counter?.limitType, "hard");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository upsertQuotaCounter conflict updates existing counter", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const later = "2026-04-27T12:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-conflict-acct",
      ownerId: "owner-conflict",
      workspaceId: "workspace-conflict",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    repo.upsertQuotaCounter({
      counterId: "sqlite-quota-conflict",
      accountId: "sqlite-conflict-acct",
      metricType: "api_call",
      windowStart: "2026-05-01T00:00:00.000Z",
      windowEnd: "2026-06-01T00:00:00.000Z",
      usedQuantity: 10,
      limitQuantity: 50,
      limitType: "soft",
      resetPolicy: "calendar_month",
      updatedAt: now,
    });

    // Upsert again with same account, metric, window - should update
    repo.upsertQuotaCounter({
      counterId: "sqlite-quota-conflict",
      accountId: "sqlite-conflict-acct",
      metricType: "api_call",
      windowStart: "2026-05-01T00:00:00.000Z",
      windowEnd: "2026-06-01T00:00:00.000Z",
      usedQuantity: 30,
      limitQuantity: 75,
      limitType: "hard",
      resetPolicy: "calendar_month",
      updatedAt: later,
    });

    const counter = repo.getQuotaCounter(
      "sqlite-conflict-acct",
      "api_call",
      "2026-05-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
    );

    assert.ok(counter);
    assert.equal(counter?.usedQuantity, 30, "used quantity should be updated");
    assert.equal(counter?.limitQuantity, 75, "limit should be updated");
    assert.equal(counter?.limitType, "hard", "limit type should be updated");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository insertLedgerEntry and listLedgerEntriesForAccount round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-ledger-acct",
      ownerId: "owner-ledger",
      workspaceId: "workspace-ledger",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Create usage event first (ledger_entries has FK on usage_id)
    repo.insertUsageEvent({
      usageId: "usage-xyz",
      accountId: "sqlite-ledger-acct",
      subjectId: "subject-ledger",
      workspaceId: "workspace-ledger",
      tenantId: "tenant-ledger",
      taskId: null,
      executionId: null,
      stepId: null,
      metricType: "api_call",
      quantity: 1,
      source: "ledger_test",
      unitPriceUsd: 0.01,
      capturedAt: now,
    });

    repo.insertLedgerEntry({
      entryId: "sqlite-ledger-001",
      accountId: "sqlite-ledger-acct",
      usageId: "usage-xyz",
      periodId: "2026-04",
      entryType: "usage_charge",
      amountUsd: 1.5,
      currency: "USD",
      sourceRef: "invoice-line-1",
      recordedAt: now,
    });

    const entries = repo.listLedgerEntriesForAccount("sqlite-ledger-acct");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.entryId, "sqlite-ledger-001");
    assert.equal(entries[0]?.entryType, "usage_charge");
    assert.equal(entries[0]?.amountUsd, 1.5);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository insertEntitlementDecision and listEntitlementDecisionsForAccount round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";

    // Create billing account first (required by FK constraint)
    repo.upsertBillingAccount({
      accountId: "sqlite-entitlement-acct",
      ownerId: "owner-entitlement",
      workspaceId: "workspace-entitlement",
      planId: "plan-basic",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    repo.insertEntitlementDecision({
      decisionId: "sqlite-entitlement-001",
      accountId: "sqlite-entitlement-acct",
      featureKey: "advanced_analytics",
      metricType: "api_call",
      requestedQuantity: 10,
      allowed: 1,
      decisionType: "allow",
      reasonCode: "within_quota",
      policyVersion: "2026-04",
      evaluatedAt: now,
    });

    const decisions = repo.listEntitlementDecisionsForAccount("sqlite-entitlement-acct");
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.decisionId, "sqlite-entitlement-001");
    assert.equal(decisions[0]?.featureKey, "advanced_analytics");
    assert.equal(decisions[0]?.allowed, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository listBillingPaymentSessionsForInvoice returns sessions for invoice", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    insertBillingFixture(repo, now);

    const sessions = repo.listBillingPaymentSessionsForInvoice("sqlite-inv-001", 10, "tenant-billing-sqlite");
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.sessionId, "sqlite-pay-001");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository listBillingPaymentSessions with status filter", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    insertBillingFixture(repo, now);

    // Update the payment session status to paid
    repo.updateBillingPaymentSessionStatus({
      sessionId: "sqlite-pay-001",
      status: "paid",
      updatedAt: now,
      settledAt: now,
    });

    const paidSessions = repo.listBillingPaymentSessions({
      status: "paid",
      tenantId: "tenant-billing-sqlite",
      limit: 10,
    });
    assert.equal(paidSessions.length, 1);
    assert.equal(paidSessions[0]?.sessionId, "sqlite-pay-001");
  } finally {
    cleanupPath(workspace);
  }
});

test("BillingRepository updateTaskStatus and getTask work together", () => {
  const workspace = createTempWorkspace("aa-sqlite-billing-repo-");
  const dbPath = join(workspace, "billing-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new BillingRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const later = "2026-04-27T11:30:00.000Z";
    createTestTask(taskRepo, "sqlite-billing-task-status", now);

    repo.updateTaskStatus("sqlite-billing-task-status", "queued", later);

    const task = repo.getTask("sqlite-billing-task-status") as { status: string } | undefined;
    assert.ok(task);
    assert.equal(task.status, "queued");
  } finally {
    cleanupPath(workspace);
  }
});