/**
 * Billing Service
 *
 * Core billing and monetization engine handling accounts, quotas, usage tracking,
 * invoices, and payment gateway integration. Designed for multi-tenant SaaS
 * billing with configurable plan catalogs.
 *
 * Key entities:
 * - BillingAccount: Customer account linked to an owner (user) and optionally a workspace
 * - Entitlement: Feature access decision (allow/deny/warn/degrade) based on plan
 * - QuotaCounter: Tracks usage against plan limits per metric type per time window
 * - UsageEvent: Individual usage record for billing purposes
 * - LedgerEntry: Financial record (charges or credits) per billing period
 * - Invoice: Aggregate billing document grouping ledger entries
 * - PaymentSession: Checkout/payment flow managed through a payment gateway
 *
 * Billing workflow:
 * 1. Account is created with a plan from the billing catalog
 * 2. Feature access is evaluated via evaluateEntitlement() before allowing actions
 * 3. Usage is recorded via recordUsage() which updates quota counters and ledger
 * 4. Invoices are created periodically to bill accumulated charges
 * 5. Checkout sessions initiate payment collection via payment gateway
 * 6. Payment reconciliation syncs gateway status back to local records
 *
 * @see billing-payment-gateway.ts for payment gateway abstraction
 * @see docs_zh/contracts/billing_contract.md
 */

import { dirname, join } from "node:path";

import { MonetizationError } from "../../platform/contracts/errors.js";
import {
  createBudgetLedger,
  createBudgetSettlement,
  type BudgetLedger,
  type BudgetReservation,
} from "../../platform/contracts/executable-contracts/index.js";
import { ArtifactStore } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import {
  ManualBillingPaymentGateway,
  type BillingPaymentGateway,
  type BillingPaymentSessionStatusSnapshot,
} from "./billing-payment-gateway.js";
import {
  loadBillingPlanCatalog,
  type BillingMetricType,
  type BillingPlanCatalog,
  type PlanCatalogEntry,
} from "../../platform/five-plane-control-plane/config-center/billing-plan-catalog.js";
import type { SandboxPolicy } from "../../platform/five-plane-control-plane/iam/sandbox-policy.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import { BudgetAllocator } from "../../platform/five-plane-execution/budget-allocator.js";
import type {
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
  EntitlementDecisionRecord,
  EntitlementDecisionType,
  LedgerEntryRecord,
  QuotaCounterRecord,
  TaskRecord,
  UsageEventRecord,
} from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type {
  BillingAccountSummary,
  BillingServiceOptions,
  CreateBillingAdjustmentInput,
  CreateBillingAccountInput,
  CreateBillingCheckoutSessionInput,
  CreateBillingInvoiceInput,
  EvaluateEntitlementInput,
  EvaluateEntitlementResult,
  ExportBillingSummaryResult,
  ReconcileBillingPaymentSessionInput,
  ReconcilePendingPaymentSessionsInput,
  ReconcilePendingPaymentSessionsResult,
  RecordUsageInput,
  RecordUsageResult,
  RefundBillingInvoiceInput,
  SettleBillingPaymentSessionInput,
} from "./types.js";
import {
  assertIdentifier,
  assertPositiveNumber,
  buildBillingMarkdown,
  monthWindow,
  roundCurrency,
} from "./utils.js";

// Re-export types for consumers
export type { BillingMetricType, PlanCatalogEntry } from "../../platform/five-plane-control-plane/config-center/billing-plan-catalog.js";
export type {
  BillingAccountSummary,
  BillingServiceOptions,
  CreateBillingAccountInput,
  CreateBillingAdjustmentInput,
  CreateBillingCheckoutSessionInput,
  CreateBillingInvoiceInput,
  EvaluateEntitlementInput,
  EvaluateEntitlementResult,
  ExportBillingSummaryResult,
  ReconcileBillingPaymentSessionInput,
  ReconcilePendingPaymentSessionsInput,
  ReconcilePendingPaymentSessionsResult,
  RecordUsageInput,
  RecordUsageResult,
  RefundBillingInvoiceInput,
  SettleBillingPaymentSessionInput,
} from "./types.js";

const AUTO_CREATED_BUDGET_LEDGER_HARD_CAP_BUFFER = 1.5;

/**
 * Billing Service
 *
 * Central service for all billing operations: account management, entitlement
 * evaluation, usage recording, invoice creation, and payment reconciliation.
 */
export class BillingService {
  private readonly artifactStore: ArtifactStore;
  private readonly planCatalog: BillingPlanCatalog;
  private readonly policyVersion: string;
  private readonly paymentGateway: BillingPaymentGateway;
  private readonly budgetAllocator: BudgetAllocator;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: BillingServiceOptions = {},
  ) {
    // Initialize plan catalog with optional overrides
    const catalogOptions: { configRoot?: string; env?: NodeJS.ProcessEnv; sandboxPolicy?: SandboxPolicy } = {};
    if (options.configRoot != null) {
      catalogOptions.configRoot = options.configRoot;
    }
    if (options.env != null) {
      catalogOptions.env = options.env;
    }
    if (options.sandboxPolicy != null) {
      catalogOptions.sandboxPolicy = options.sandboxPolicy;
    }
    this.planCatalog = options.planCatalog ?? loadBillingPlanCatalog(catalogOptions);
    this.policyVersion = options.policyVersion ?? "phase3.billing.v1";
    // Default to manual gateway if none provided
    this.paymentGateway = options.paymentGateway ?? new ManualBillingPaymentGateway();
    this.budgetAllocator = new BudgetAllocator();
    // Artifact store for exporting billing reports
    this.artifactStore = new ArtifactStore(
      options.artifactStoreOptions ?? {
        rootDir: join(dirname(db.filePath), "artifacts"),
      },
    );
  }

  /**
   * Creates a new billing account.
   * Account is associated with an owner (user) and optionally a workspace.
   * Initial status is active unless specified otherwise.
   */
  public createAccount(input: CreateBillingAccountInput): BillingAccountRecord {
    const accountId = assertIdentifier(input.accountId ?? newId("billacct"), "billing.invalid_account_id");
    const ownerId = assertIdentifier(input.ownerId, "billing.invalid_owner_id");
    const workspaceId = input.workspaceId == null ? null : assertIdentifier(input.workspaceId, "billing.invalid_workspace_id");
    const plan = this.getPlan(input.planId);
    const timestamp = input.createdAt ?? nowIso();
    const record: BillingAccountRecord = {
      accountId,
      ownerId,
      workspaceId,
      planId: plan.planId,
      status: input.status ?? "active",
      balanceSnapshot: {
        outstandingUsd: 0,
        creditUsd: 0,
        lastCalculatedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.billing.upsertBillingAccount(record);
    return record;
  }

  /**
   * Evaluates whether an account is entitled to use a specific feature.
   *
   * Checks:
   * 1. Feature exists in the account's plan
   * 2. If metric-based, checks quota availability
   *
   * Returns a decision record with allow/deny/warn/degrade and remaining quota.
   */
  public evaluateEntitlement(input: EvaluateEntitlementInput): EvaluateEntitlementResult {
    const account = this.requireActiveAccount(input.accountId);
    const featureKey = assertIdentifier(input.featureKey, "billing.invalid_feature_key");
    const metricType = input.metricType == null ? null : assertIdentifier(input.metricType, "billing.invalid_metric_type");
    const requestedQuantity = input.requestedQuantity == null ? null : assertPositiveNumber(input.requestedQuantity, "billing.invalid_requested_quantity");
    const evaluatedAt = input.evaluatedAt ?? nowIso();
    const plan = this.getPlan(account.planId);

    let decisionType: EntitlementDecisionType = "allow";
    let reasonCode = "billing.entitlement_allowed";
    let remainingQuantity: number | null = null;
    let projectedQuantity: number | null = null;

    // Check if feature is in the plan
    if (!plan.features.includes(featureKey)) {
      decisionType = "deny";
      reasonCode = "billing.feature_not_in_plan";
    } else if (metricType != null) {
      // Metric-based entitlement: check quota limits
      const quota = plan.quotas[metricType as BillingMetricType];
      if (quota != null) {
        const window = monthWindow(evaluatedAt);
        const counter = this.store.billing.getQuotaCounter(account.accountId, metricType, window.start, window.end);
        const usedQuantity = counter?.usedQuantity ?? 0;
        projectedQuantity = roundCurrency(usedQuantity + (requestedQuantity ?? 0));
        remainingQuantity = quota.limitValue == null ? null : roundCurrency(Math.max(0, quota.limitValue - projectedQuantity));

        // Determine decision based on quota limit type
        if (quota.limitValue != null && projectedQuantity > quota.limitValue) {
          decisionType =
            quota.limitType === "hard" ? "deny" : quota.limitType === "soft" ? "warn" : "degrade";
          reasonCode = `billing.quota_${decisionType}`;
        }
      }
    }

    const decision: EntitlementDecisionRecord = {
      decisionId: newId("entitlement"),
      accountId: account.accountId,
      featureKey,
      metricType,
      requestedQuantity,
      allowed: decisionType === "deny" ? 0 : 1,
      decisionType,
      reasonCode,
      policyVersion: this.policyVersion,
      evaluatedAt,
    };
    this.store.billing.insertEntitlementDecision(decision);
    return {
      decision,
      account,
      remainingQuantity,
      projectedQuantity,
    };
  }

  /**
   * Records usage for billing purposes.
   *
   * Creates:
   * - UsageEvent: the raw usage record
   * - QuotaCounter: updated running total for the month
   * - LedgerEntry: the charge for this usage
   *
   * All three are created atomically within a transaction.
   */
  public async recordUsage(input: RecordUsageInput): Promise<RecordUsageResult> {
    const account = this.requireActiveAccount(input.accountId);
    const capturedAt = input.capturedAt ?? nowIso();
    const metricType = assertIdentifier(input.metricType, "billing.invalid_metric_type") as BillingMetricType;
    const quantity = assertPositiveNumber(input.quantity, "billing.invalid_quantity");
    const plan = this.getPlan(account.planId);
    const quota = plan.quotas[metricType];
    const window = monthWindow(capturedAt);
    const unitPriceUsd = quota?.unitPriceUsd ?? 0;
    const estimatedChargeUsd = roundCurrency(quantity * unitPriceUsd);
    let reservedBudget: { ledger: BudgetLedger; reservation: BudgetReservation } | null = null;
    let existingCounter: QuotaCounterRecord | null = null;
    let recordsPersisted = false;

    if (input.budgetControl != null && estimatedChargeUsd > 0) {
      const ledger = input.budgetControl.ledger ?? createBudgetLedger({
        tenantId: input.budgetControl.tenantId,
        harnessRunId: input.budgetControl.harnessRunId,
        currency: "USD",
        hardCap: roundCurrency(Math.max(estimatedChargeUsd, estimatedChargeUsd * AUTO_CREATED_BUDGET_LEDGER_HARD_CAP_BUFFER)),
      });
      reservedBudget = this.budgetAllocator.reserve({
        ledger,
        amount: estimatedChargeUsd,
        resourceKind: "api",
        expiresAt: new Date(
          Date.parse(capturedAt) + (input.budgetControl.reservationTtlMs ?? 5 * 60 * 1000),
        ).toISOString(),
        expectedVersion: ledger.version,
        context: {
          tenantId: input.budgetControl.tenantId,
          traceId: input.budgetControl.traceId,
          emittedBy: input.budgetControl.emittedBy,
          principal: input.budgetControl.emittedBy,
          tierLimitCurrency: ledger.currency,
        },
      });
    }

    // Create usage event record
    const usageEvent: UsageEventRecord = {
      usageId: newId("usage"),
      accountId: account.accountId,
      subjectId: assertIdentifier(input.subjectId ?? account.ownerId, "billing.invalid_subject_id"),
      workspaceId: input.workspaceId ?? account.workspaceId,
      tenantId: input.tenantId ?? null,
      taskId: input.taskId ?? null,
      executionId: input.executionId ?? null,
      stepId: input.stepId ?? null,
      metricType,
      quantity,
      source: input.source,
      unitPriceUsd,
      capturedAt,
    };

    let quotaCounter: QuotaCounterRecord | null = null;

    // Create ledger entry for the charge
    const ledgerEntry: LedgerEntryRecord = {
      entryId: newId("ledger"),
      accountId: account.accountId,
      usageId: usageEvent.usageId,
      periodId: window.periodId,
      entryType: "usage_charge",
      amountUsd: estimatedChargeUsd,
      currency: "USD",
      sourceRef: usageEvent.metricType,
      recordedAt: capturedAt,
    };

    let budgetSettlement:
      | ReturnType<typeof createBudgetSettlement>
      | undefined;
    let settledBudget:
      | Awaited<ReturnType<BudgetAllocator["settle"]>>
      | null = null;
    const counterRepository = this.store.billing as typeof this.store.billing & {
      incrementQuotaCounter?: (counter: QuotaCounterRecord, deltaQuantity: number) => QuotaCounterRecord;
    };

    try {
      // Persist all records atomically
      this.db.transaction(() => {
        existingCounter = quota == null
          ? null
          : this.store.billing.getQuotaCounter(account.accountId, metricType, window.start, window.end);
        this.store.billing.insertUsageEvent(usageEvent);
        if (quota != null) {
          const counterBase: QuotaCounterRecord = {
            counterId:
              existingCounter?.counterId ??
              newId("quota"),
            accountId: account.accountId,
            metricType,
            windowStart: window.start,
            windowEnd: window.end,
            usedQuantity: roundCurrency((existingCounter?.usedQuantity ?? 0) + quantity),
            limitQuantity: quota.limitValue,
            limitType: quota.limitType,
            resetPolicy: quota.resetPolicy,
            updatedAt: capturedAt,
          };
          quotaCounter = counterRepository.incrementQuotaCounter != null
            ? counterRepository.incrementQuotaCounter(counterBase, quantity)
            : counterBase;
          if (counterRepository.incrementQuotaCounter == null) {
            this.store.billing.upsertQuotaCounter(counterBase);
          }
        }
        this.store.billing.insertLedgerEntry(ledgerEntry);
        recordsPersisted = true;
      });

      budgetSettlement = reservedBudget == null
        ? undefined
        : createBudgetSettlement({
          budgetReservationId: reservedBudget.reservation.budgetReservationId,
          actualAmount: ledgerEntry.amountUsd,
          settlementKind: "final",
        });
      settledBudget = reservedBudget == null
        ? null
        : await this.budgetAllocator.settle({
          ledger: reservedBudget.ledger,
          reservation: reservedBudget.reservation,
          actualAmount: ledgerEntry.amountUsd,
          expectedVersion: reservedBudget.ledger.version, // R11-12: CAS atomic settle
          context: {
            principal: input.budgetControl!.emittedBy,
            tenantId: input.budgetControl!.tenantId,
            traceId: input.budgetControl!.traceId,
            emittedBy: input.budgetControl!.emittedBy,
          },
        });
    } catch (error) {
      if (recordsPersisted) {
        this.db.transaction(() => {
          if (quotaCounter != null) {
            this.store.billing.upsertQuotaCounter(existingCounter ?? {
              ...quotaCounter,
              usedQuantity: 0,
            });
          }
          this.store.billing.insertLedgerEntry({
            entryId: newId("ledger"),
            accountId: account.accountId,
            usageId: null,
            periodId: window.periodId,
            entryType: "adjustment",
            amountUsd: roundCurrency(-ledgerEntry.amountUsd),
            currency: "USD",
            sourceRef: `rollback:${usageEvent.usageId}`,
            recordedAt: nowIso(),
          });
        });
      }
      if (reservedBudget != null) {
        this.budgetAllocator.release({
          ledger: reservedBudget.ledger,
          reservation: reservedBudget.reservation,
          expectedVersion: reservedBudget.ledger.version, // R11-12: CAS atomic release
          reasonCode: "budget.billing_usage_record_failed",
          context: {
            principal: input.budgetControl!.emittedBy,
            tenantId: input.budgetControl!.tenantId,
            traceId: input.budgetControl!.traceId,
            emittedBy: input.budgetControl!.emittedBy,
          },
        });
      }
      throw error;
    }

    return {
      usageEvent,
      quotaCounter,
      ledgerEntry,
      ...(reservedBudget != null ? { budgetReservation: reservedBudget.reservation } : {}),
      ...(budgetSettlement != null ? { budgetSettlement } : {}),
      ...(settledBudget != null ? { budgetLedger: settledBudget.ledger } : {}),
    };
  }

  /**
   * Builds a summary of account state including quotas, usage, and ledger.
   * Used for reporting and invoice creation.
   */
  public buildAccountSummary(accountId: string): BillingAccountSummary {
    const account = this.requireActiveAccount(accountId);
    const plan = this.getPlan(account.planId);
    const recentUsage = this.store.billing.listUsageEventsForAccount(account.accountId, 50);
    const recentLedgerEntries = this.store.billing.listLedgerEntriesForAccount(account.accountId, 50);
    const recentDecisions = this.store.billing.listEntitlementDecisionsForAccount(account.accountId, 50);

    // Map quota counters to display format with remaining calculation
    const quotas = this.store.billing.listQuotaCounters(account.accountId).map((counter) => ({
      metricType: counter.metricType,
      usedQuantity: counter.usedQuantity,
      limitQuantity: counter.limitQuantity,
      remainingQuantity:
        counter.limitQuantity == null ? null : roundCurrency(Math.max(0, counter.limitQuantity - counter.usedQuantity)),
      limitType: counter.limitType,
      windowStart: counter.windowStart,
      windowEnd: counter.windowEnd,
    }));

    return {
      account,
      plan,
      generatedAt: nowIso(),
      totals: {
        usageEventCount: recentUsage.length,
        ledgerEntryCount: recentLedgerEntries.length,
        totalBilledUsd: roundCurrency(recentLedgerEntries.reduce((sum, entry) => sum + entry.amountUsd, 0)),
      },
      quotas,
      recentUsage,
      recentLedgerEntries,
      recentDecisions,
    };
  }

  public createAdjustment(input: CreateBillingAdjustmentInput): LedgerEntryRecord {
    const account = this.requireActiveAccount(input.accountId);
    const recordedAt = input.recordedAt ?? nowIso();
    const entry: LedgerEntryRecord = {
      entryId: newId("ledger"),
      accountId: account.accountId,
      usageId: null,
      periodId: input.periodId,
      entryType: "adjustment",
      amountUsd: roundCurrency(input.amountUsd),
      currency: "USD",
      sourceRef: input.sourceRef ?? input.reasonCode,
      recordedAt,
    };
    this.store.billing.insertLedgerEntry(entry);
    this.store.billing.upsertBillingAccount({
      ...account,
      balanceSnapshot: this.recalculateBalanceSnapshot(account.accountId, recordedAt),
      updatedAt: recordedAt,
    });
    return entry;
  }

  public refundInvoice(input: RefundBillingInvoiceInput): LedgerEntryRecord {
    const invoice = this.requireInvoice(input.invoiceId, input.tenantId);
    const account = this.requireActiveAccount(invoice.accountId);
    const recordedAt = input.recordedAt ?? nowIso();
    const entry: LedgerEntryRecord = {
      entryId: newId("ledger"),
      accountId: account.accountId,
      usageId: null,
      periodId: invoice.periodId,
      entryType: "refund",
      amountUsd: roundCurrency(-Math.abs(input.refundAmountUsd)),
      currency: "USD",
      sourceRef: input.reasonCode,
      recordedAt,
    };
    this.store.billing.insertLedgerEntry(entry);
    this.store.billing.upsertBillingAccount({
      ...account,
      balanceSnapshot: this.recalculateBalanceSnapshot(account.accountId, recordedAt),
      updatedAt: recordedAt,
    });
    return entry;
  }

  /**
   * Exports account summary as JSON and Markdown artifacts.
   * Returns the summary and artifact references.
   */
  public exportAccountSummary(accountId: string): ExportBillingSummaryResult {
    const summary = this.buildAccountSummary(accountId);
    this.ensureBillingArtifactTask(summary.generatedAt);

    // Export as JSON artifact
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: "billing_reporting",
      executionId: null,
      stepId: null,
      kind: "billing_account_summary",
      fileName: `billing-summary-${summary.account.accountId}-${summary.generatedAt}.json`,
      content: summary,
      lineage: {
        source: "billing_service",
        accountId: summary.account.accountId,
        planId: summary.plan.planId,
      },
    });
    this.store.artifact.insertArtifact(jsonArtifact.record);

    // Export as Markdown artifact for human review
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "billing_reporting",
      executionId: null,
      stepId: null,
      kind: "billing_account_summary",
      fileName: `billing-summary-${summary.account.accountId}-${summary.generatedAt}.md`,
      content: buildBillingMarkdown(summary),
      lineage: {
        source: "billing_service",
        accountId: summary.account.accountId,
        planId: summary.plan.planId,
        format: "markdown",
      },
    });
    this.store.artifact.insertArtifact(markdownArtifact.record);

    return {
      summary,
      jsonArtifact: jsonArtifact.ref,
      markdownArtifact: markdownArtifact.ref,
    };
  }

  /**
   * Creates an invoice for an account.
   * Invoice aggregates all ledger entries from the account's most recent period.
   */
  public createInvoice(input: CreateBillingInvoiceInput): BillingInvoiceRecord {
    const summary = this.buildAccountSummary(input.accountId);
    const createdAt = input.createdAt ?? nowIso();
    const taxUsd = roundCurrency(input.taxUsd ?? 0);
    const invoice: BillingInvoiceRecord = {
      invoiceId: newId("invoice"),
      accountId: summary.account.accountId,
      workspaceId: summary.account.workspaceId,
      tenantId: input.tenantId ?? null,
      periodId: summary.recentLedgerEntries[0]?.periodId ?? monthWindow(createdAt).periodId,
      currency: "USD",
      subtotalUsd: summary.totals.totalBilledUsd,
      taxUsd,
      totalUsd: roundCurrency(summary.totals.totalBilledUsd + taxUsd),
      status: "open",
      summaryJson: JSON.stringify(summary),
      externalInvoiceRef: input.externalInvoiceRef ?? null,
      dueAt: input.dueAt ?? null,
      createdAt,
      updatedAt: createdAt,
      paidAt: null,
    };

    this.store.billing.insertBillingInvoice(invoice);
    return invoice;
  }

  /**
   * Creates a checkout session with the payment gateway.
   * Returns a session record with checkout URL for the customer.
   */
  public async createCheckoutSession(input: CreateBillingCheckoutSessionInput): Promise<BillingPaymentSessionRecord> {
    const invoice = this.requireInvoice(input.invoiceId, input.tenantId);

    // Only open invoices can initiate checkout
    if (invoice.status !== "open") {
      throw new MonetizationError(`billing.invoice_not_collectable:${invoice.status}`, `Invoice is not collectable: ${invoice.status}`, {
        details: { invoiceId: invoice.invoiceId, status: invoice.status },
      });
    }
    const account = this.requireActiveAccount(invoice.accountId);
    const createdAt = input.createdAt ?? nowIso();

    // Create checkout session via payment gateway
    const definition = await Promise.resolve(this.paymentGateway.createCheckoutSession({
      invoice,
      account,
      createdAt,
    }));

    // Persist session record
    const session: BillingPaymentSessionRecord = {
      sessionId: newId("paysess"),
      invoiceId: invoice.invoiceId,
      accountId: invoice.accountId,
      gatewayKind: definition.gatewayKind,
      gatewaySessionRef: definition.gatewaySessionRef,
      checkoutUrl: definition.checkoutUrl,
      status: "pending",
      amountUsd: invoice.totalUsd,
      currency: invoice.currency,
      expiresAt: definition.expiresAt,
      createdAt,
      updatedAt: createdAt,
      settledAt: null,
      failureCode: null,
    };

    this.store.billing.insertBillingPaymentSession(session);
    return session;
  }

  /**
   * Settles (completes) a payment session after successful payment.
   * Updates invoice and session status, creates credit ledger entry.
   */
  public settlePaymentSession(input: SettleBillingPaymentSessionInput): {
    session: BillingPaymentSessionRecord;
    invoice: BillingInvoiceRecord;
  } {
    const existing = this.requirePaymentSession(input.sessionId, input.tenantId);

    // Already paid: return current state
    if (existing.status === "paid") {
      return {
        session: existing,
        invoice: this.requireInvoice(existing.invoiceId, input.tenantId),
      };
    }

    const settledAt = input.settledAt ?? nowIso();
    const invoice = this.requireInvoice(existing.invoiceId, input.tenantId);

    // Atomic update: session, invoice, and credit ledger entry
    this.db.transaction(() => {
      this.store.billing.updateBillingPaymentSessionStatus({
        sessionId: existing.sessionId,
        status: "paid",
        updatedAt: settledAt,
        settledAt,
      });
      this.store.billing.updateBillingInvoiceStatus({
        invoiceId: existing.invoiceId,
        status: "paid",
        updatedAt: settledAt,
        paidAt: settledAt,
      });
      // Credit ledger entry to offset the original charge
      this.store.billing.insertLedgerEntry({
        entryId: newId("ledger"),
        accountId: existing.accountId,
        usageId: null,
        periodId: invoice.periodId,
        entryType: "credit",
        amountUsd: roundCurrency(-invoice.totalUsd),
        currency: invoice.currency,
        sourceRef: `payment_session:${existing.sessionId}`,
        recordedAt: settledAt,
      });
    });

    return {
      session: this.requirePaymentSession(existing.sessionId, input.tenantId),
      invoice: this.requireInvoice(existing.invoiceId, input.tenantId),
    };
  }

  /**
   * Reconciles a payment session from gateway webhook or status check.
   * Handles status updates (paid, failed, cancelled) and routes to settlement if paid.
   */
  public reconcilePaymentSession(input: ReconcileBillingPaymentSessionInput): {
    session: BillingPaymentSessionRecord;
    invoice: BillingInvoiceRecord;
  } {
    const gatewaySessionRef = assertIdentifier(
      input.gatewaySessionRef,
      "billing.invalid_gateway_session_ref",
    );
    const existing = this.store.billing.getBillingPaymentSessionByGatewayRef(input.gatewayKind, gatewaySessionRef, input.tenantId);
    if (!existing) {
      throw new MonetizationError(
        `billing.payment_session_not_found:${input.gatewayKind}:${gatewaySessionRef}`,
        `Billing payment session not found for gateway reference: ${gatewaySessionRef}`,
        {
          details: { gatewayKind: input.gatewayKind, gatewaySessionRef, tenantId: input.tenantId ?? null },
        },
      );
    }

    // If gateway reports paid, settle the session
    if (input.status === "paid") {
      return this.settlePaymentSession({
        sessionId: existing.sessionId,
        ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
        ...(input.occurredAt ? { settledAt: input.occurredAt } : {}),
      });
    }

    // Otherwise update to the new status (failed, cancelled, etc.)
    const occurredAt = input.occurredAt ?? nowIso();
    this.store.billing.updateBillingPaymentSessionStatus({
      sessionId: existing.sessionId,
      status: input.status,
      updatedAt: occurredAt,
      settledAt: null,
      failureCode: input.status === "failed" ? input.failureCode ?? "billing.gateway_failed" : null,
    });

    return {
      session: this.requirePaymentSession(existing.sessionId, input.tenantId),
      invoice: this.requireInvoice(existing.invoiceId, input.tenantId),
    };
  }

  /**
   * Batch reconciles all pending payment sessions.
   *
   * Scans pending sessions, queries each gateway for current status,
   * and reconciles any that have changed status.
   *
   * Returns detailed results per session scanned.
   */
  public async reconcilePendingPaymentSessions(
    input: ReconcilePendingPaymentSessionsInput = {},
  ): Promise<ReconcilePendingPaymentSessionsResult> {
    // Fetch pending sessions with optional filters
    const pendingSessions = this.store.billing.listBillingPaymentSessions({
      status: "pending",
      ...(input.gatewayKind != null ? { gatewayKind: input.gatewayKind } : {}),
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      ...(input.limit != null ? { limit: input.limit } : {}),
    });
    const results: ReconcilePendingPaymentSessionsResult["results"] = [];

    for (const session of pendingSessions) {
      const invoice = this.requireInvoice(session.invoiceId, input.tenantId);

      // Skip sessions for different tenant (tenant filtering)
      if (input.tenantId !== undefined && (invoice.tenantId ?? null) !== (input.tenantId ?? null)) {
        results.push({
          sessionId: session.sessionId,
          invoiceId: session.invoiceId,
          gatewayKind: session.gatewayKind,
          previousStatus: session.status,
          nextStatus: null,
          changed: false,
          reason: "tenant_filtered",
        });
        continue;
      }

      const account = this.requireActiveAccount(invoice.accountId);

      // Fetch status from gateway
      const snapshot = await this.fetchGatewayStatusSnapshot(session, invoice, account);
      if (snapshot == null) {
        // Gateway doesn't support status fetching
        results.push({
          sessionId: session.sessionId,
          invoiceId: session.invoiceId,
          gatewayKind: session.gatewayKind,
          previousStatus: session.status,
          nextStatus: null,
          changed: false,
          reason: this.paymentGateway.fetchPaymentSessionStatus ? "no_status" : "unsupported_gateway",
        });
        continue;
      }

      // No change: skip
      if (snapshot.status === session.status) {
        results.push({
          sessionId: session.sessionId,
          invoiceId: session.invoiceId,
          gatewayKind: session.gatewayKind,
          previousStatus: session.status,
          nextStatus: snapshot.status,
          changed: false,
          reason: "unchanged",
        });
        continue;
      }

      // Reconcile the status change
      this.reconcilePaymentSession({
        gatewayKind: snapshot.gatewayKind,
        gatewaySessionRef: snapshot.gatewaySessionRef,
        status: snapshot.status,
        tenantId: invoice.tenantId,
        occurredAt: snapshot.occurredAt ?? input.occurredAt,
        ...(snapshot.failureCode != null ? { failureCode: snapshot.failureCode } : {}),
      });
      results.push({
        sessionId: session.sessionId,
        invoiceId: session.invoiceId,
        gatewayKind: session.gatewayKind,
        previousStatus: session.status,
        nextStatus: snapshot.status,
        changed: true,
        reason: "reconciled",
      });
    }

    return {
      scannedCount: pendingSessions.length,
      reconciledCount: results.filter((item) => item.reason === "reconciled").length,
      unchangedCount: results.filter((item) => item.reason === "unchanged").length,
      skippedCount: results.filter((item) => item.reason !== "reconciled" && item.reason !== "unchanged").length,
      results,
    };
  }

  /** Lists invoices for an account */
  public listInvoices(accountId: string, limit = 50, tenantId?: string | null): BillingInvoiceRecord[] {
    const account = this.requireActiveAccount(accountId);
    return this.store.billing.listBillingInvoicesForAccount(account.accountId, limit, tenantId);
  }

  /** Lists payment sessions for an invoice */
  public listPaymentSessions(invoiceId: string, limit = 50, tenantId?: string | null): BillingPaymentSessionRecord[] {
    const invoice = this.requireInvoice(invoiceId, tenantId);
    return this.store.billing.listBillingPaymentSessionsForInvoice(invoice.invoiceId, limit, tenantId);
  }

  /** Looks up a plan from the catalog, validates it exists */
  private getPlan(planId: string): PlanCatalogEntry {
    const normalizedPlanId = assertIdentifier(planId, "billing.invalid_plan_id");
    const plan = this.planCatalog[normalizedPlanId];
    if (!plan) {
      throw new MonetizationError(`billing.plan_not_found:${normalizedPlanId}`, `Plan not found: ${normalizedPlanId}`, {
        details: { planId: normalizedPlanId },
      });
    }
    return plan;
  }

  /** Requires an active account, throws if not found or not active */
  private requireActiveAccount(accountId: string): BillingAccountRecord {
    const normalizedAccountId = assertIdentifier(accountId, "billing.invalid_account_id");
    const account = this.store.billing.getBillingAccount(normalizedAccountId);
    if (!account) {
      throw new MonetizationError(`billing.account_not_found:${normalizedAccountId}`, `Billing account not found: ${normalizedAccountId}`, {
        details: { accountId: normalizedAccountId },
      });
    }
    if (account.status !== "active") {
      throw new MonetizationError(`billing.account_not_active:${account.status}`, `Billing account is not active: ${account.status}`, {
        details: { accountId: normalizedAccountId, status: account.status },
      });
    }
    return account;
  }

  private recalculateBalanceSnapshot(accountId: string, calculatedAt: string): NonNullable<BillingAccountRecord["balanceSnapshot"]> {
    const ledgerEntries = this.store.billing.listLedgerEntriesForAccount(accountId, 1_000);
    const outstandingUsd = roundCurrency(ledgerEntries.reduce((sum, entry) => sum + entry.amountUsd, 0));
    const creditUsd = roundCurrency(Math.abs(ledgerEntries
      .filter((entry) => entry.entryType === "credit" || entry.entryType === "refund")
      .reduce((sum, entry) => sum + Math.min(0, entry.amountUsd), 0)));
    return {
      outstandingUsd,
      creditUsd,
      lastCalculatedAt: calculatedAt,
    };
  }

  /** Requires an invoice, throws if not found */
  private requireInvoice(invoiceId: string, tenantId?: string | null): BillingInvoiceRecord {
    const normalizedInvoiceId = assertIdentifier(invoiceId, "billing.invalid_invoice_id");
    const invoice = this.store.billing.getBillingInvoice(normalizedInvoiceId, tenantId);
    if (!invoice) {
      throw new MonetizationError(`billing.invoice_not_found:${normalizedInvoiceId}`, `Billing invoice not found: ${normalizedInvoiceId}`, {
        details: { invoiceId: normalizedInvoiceId, tenantId: tenantId ?? null },
      });
    }
    return invoice;
  }

  /** Requires a payment session, throws if not found */
  private requirePaymentSession(sessionId: string, tenantId?: string | null): BillingPaymentSessionRecord {
    const normalizedSessionId = assertIdentifier(sessionId, "billing.invalid_payment_session_id");
    const session = this.store.billing.getBillingPaymentSession(normalizedSessionId, tenantId);
    if (!session) {
      throw new MonetizationError(`billing.payment_session_not_found:${normalizedSessionId}`, `Billing payment session not found: ${normalizedSessionId}`, {
        details: { sessionId: normalizedSessionId, tenantId: tenantId ?? null },
      });
    }
    return session;
  }

  /**
   * Fetches payment session status from the gateway.
   * Returns null if gateway doesn't support status fetching or kind mismatch.
   */
  private async fetchGatewayStatusSnapshot(
    session: BillingPaymentSessionRecord,
    invoice: BillingInvoiceRecord,
    account: BillingAccountRecord,
  ): Promise<BillingPaymentSessionStatusSnapshot | null> {
    // Gateway kind must match session
    if (this.paymentGateway.kind !== session.gatewayKind) {
      return null;
    }
    // Gateway must support status fetching
    if (this.paymentGateway.fetchPaymentSessionStatus == null) {
      return null;
    }
    return Promise.resolve(this.paymentGateway.fetchPaymentSessionStatus({ session, invoice, account }));
  }

  /**
   * Ensures a placeholder task exists for billing artifact references.
   * Required because artifacts reference a task_id.
   */
  private ensureBillingArtifactTask(createdAt: string): void {
    if (this.store.task.getTask("billing_reporting")) {
      return;
    }

    const task: TaskRecord = {
      id: "billing_reporting",
      parentId: null,
      rootId: "billing_reporting",
      divisionId: "system_admin",
      title: "Billing reporting",
      status: "done",
      source: "system",
      priority: "normal",
      inputJson: JSON.stringify({ purpose: "billing_summary_export" }),
      normalizedInputJson: JSON.stringify({ purpose: "billing_summary_export" }),
      outputJson: JSON.stringify({ result: "billing_summary_exported" }),
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: createdAt,
    };
    this.store.task.insertTask(task);
  }
}
