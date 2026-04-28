import type { ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import type { BillingPaymentGateway } from "./billing-payment-gateway.js";
import type {
  BillingMetricType,
  BillingPlanCatalog,
  PlanCatalogEntry,
} from "../../platform/control-plane/config-center/billing-plan-catalog.js";
import type { SandboxPolicy } from "../../platform/control-plane/iam/sandbox-policy.js";
import type {
  ArtifactRef,
  BillingAccountRecord,
  BillingAccountStatus,
  BillingLimitType,
  BillingPaymentSessionRecord,
  BillingUsageSource,
  EntitlementDecisionRecord,
  LedgerEntryRecord,
  QuotaCounterRecord,
  UsageEventRecord,
} from "../../platform/contracts/types/domain.js";
import type {
  BudgetLedger,
  BudgetReservation,
  BudgetSettlement,
} from "../../platform/contracts/executable-contracts/index.js";

export interface CreateBillingAccountInput {
  accountId?: string;
  ownerId: string;
  workspaceId?: string | null;
  planId: string;
  status?: BillingAccountStatus;
  createdAt?: string;
}

export interface RevenueSharePolicy {
  policyId: string;
  grossSplit: Readonly<Record<string, number>>;
  taxHandling: "platform_withholds" | "publisher_remits" | "split_by_region";
  refundPolicy: "clawback_proportional" | "platform_absorbs" | "publisher_absorbs";
  settlementCycle: "weekly" | "monthly" | "quarterly";
}

export interface EvaluateEntitlementInput {
  accountId: string;
  featureKey: string;
  metricType?: BillingMetricType | null;
  requestedQuantity?: number;
  evaluatedAt?: string;
}

export interface EvaluateEntitlementResult {
  decision: EntitlementDecisionRecord;
  account: BillingAccountRecord;
  remainingQuantity: number | null;
  projectedQuantity: number | null;
}

export interface RecordUsageInput {
  accountId: string;
  subjectId?: string;
  workspaceId?: string | null;
  tenantId?: string | null;
  taskId?: string | null;
  harnessRunId?: string | null;
  nodeRunId?: string | null;
  attemptId?: string | null;
  /** @deprecated legacy projection identifier; use harnessRunId */
  executionId?: string | null;
  /** @deprecated legacy projection identifier; use nodeRunId */
  stepId?: string | null;
  metricType: BillingMetricType;
  /** Multi-dimensional usage dimensions for granular tracking per §53.2 */
  metricDimensions?: ReadonlyArray<{
    readonly dimensionKey: string;
    readonly dimensionValue: string;
  }>;
  quantity: number;
  source: BillingUsageSource;
  capturedAt?: string;
  budgetControl?: {
    readonly tenantId: string;
    readonly harnessRunId: string;
    readonly traceId: string;
    readonly emittedBy: string;
    readonly ledger?: BudgetLedger;
    readonly reservationTtlMs?: number;
  };
}

export interface RecordUsageResult {
  usageEvent: UsageEventRecord;
  quotaCounter: QuotaCounterRecord | null;
  ledgerEntry: LedgerEntryRecord;
  budgetReservation?: BudgetReservation;
  budgetSettlement?: BudgetSettlement;
  budgetLedger?: BudgetLedger;
  /** Multi-dimensional quota counters updated per §53.2 */
  dimensionQuotaCounters?: ReadonlyArray<QuotaCounterRecord>;
}

export interface BillingAccountSummary {
  account: BillingAccountRecord;
  plan: PlanCatalogEntry;
  generatedAt: string;
  totals: {
    usageEventCount: number;
    ledgerEntryCount: number;
    totalBilledUsd: number;
  };
  quotas: Array<{
    metricType: string;
    usedQuantity: number;
    limitQuantity: number | null;
    remainingQuantity: number | null;
    limitType: BillingLimitType | null;
    windowStart: string;
    windowEnd: string;
  }>;
  recentUsage: UsageEventRecord[];
  recentLedgerEntries: LedgerEntryRecord[];
  recentDecisions: EntitlementDecisionRecord[];
}

export interface CreateBillingInvoiceInput {
  accountId: string;
  tenantId?: string | null;
  dueAt?: string | null;
  taxUsd?: number;
  createdAt?: string;
  externalInvoiceRef?: string | null;
}

export interface CreateBillingCheckoutSessionInput {
  invoiceId: string;
  tenantId?: string | null;
  createdAt?: string;
}

export interface SettleBillingPaymentSessionInput {
  sessionId: string;
  tenantId?: string | null;
  settledAt?: string;
}

export interface ReconcileBillingPaymentSessionInput {
  gatewayKind: BillingPaymentSessionRecord["gatewayKind"];
  gatewaySessionRef: string;
  status: BillingPaymentSessionRecord["status"];
  tenantId?: string | null;
  occurredAt?: string;
  failureCode?: string | null;
}

export interface ReconcilePendingPaymentSessionsInput {
  tenantId?: string | null;
  gatewayKind?: BillingPaymentSessionRecord["gatewayKind"] | null;
  limit?: number;
  occurredAt?: string;
}

export interface ReconcilePendingPaymentSessionsResult {
  scannedCount: number;
  reconciledCount: number;
  unchangedCount: number;
  skippedCount: number;
  results: Array<{
    sessionId: string;
    invoiceId: string;
    gatewayKind: BillingPaymentSessionRecord["gatewayKind"];
    previousStatus: BillingPaymentSessionRecord["status"];
    nextStatus: BillingPaymentSessionRecord["status"] | null;
    changed: boolean;
    reason: "reconciled" | "unchanged" | "unsupported_gateway" | "no_status" | "tenant_filtered";
  }>;
}

export interface ExportBillingSummaryResult {
  summary: BillingAccountSummary;
  jsonArtifact: ArtifactRef;
  markdownArtifact: ArtifactRef;
}

export interface BillingServiceOptions {
  artifactStoreOptions?: ArtifactStoreOptions;
  planCatalog?: BillingPlanCatalog;
  configRoot?: string;
  env?: NodeJS.ProcessEnv;
  sandboxPolicy?: SandboxPolicy;
  policyVersion?: string;
  paymentGateway?: BillingPaymentGateway;
}

export interface CreateBillingAdjustmentInput {
  accountId: string;
  periodId: string;
  amountUsd: number;
  reasonCode: string;
  sourceRef?: string | null;
  recordedAt?: string;
}

export interface RefundBillingInvoiceInput {
  invoiceId: string;
  tenantId?: string | null;
  refundAmountUsd: number;
  reasonCode: string;
  recordedAt?: string;
}
