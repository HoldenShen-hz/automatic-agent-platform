/**
 * @fileoverview Billing Types - Billing account, invoice, payment, and usage records.
 *
 * Contains records related to billing, payments, quotas,
 * and feature entitlement decisions.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  BillingAccountStatus,
  BillingUsageSource,
  BillingLimitType,
  BillingResetPolicy,
  BillingInvoiceStatus,
  BillingPaymentGatewayKind,
  BillingPaymentSessionStatus,
  EntitlementDecisionType,
  Timestamp,
} from "./primitives.js";

// ---------------------------------------------------------------------------
// Billing account record
// ---------------------------------------------------------------------------

/**
 * Billing account record - top-level billing entity for a customer.
 *
 * Links billing information (invoices, payments) to an owner and workspace.
 * The planId determines pricing tiers and feature entitlements.
 */
export interface BillingAccountRecord {
  accountId: string;
  ownerId: string;
  workspaceId: string | null;
  planId: string;
  status: BillingAccountStatus;
  balanceSnapshot?: {
    outstandingUsd: number;
    creditUsd: number;
    lastCalculatedAt: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Billing invoice record
// ---------------------------------------------------------------------------

/**
 * Billing invoice record - a bill for usage within a billing period.
 *
 * Invoices aggregate usage charges, taxes, and credits for a billing period.
 * They reference external invoice IDs from payment gateways for reconciliation.
 */
export interface BillingInvoiceRecord {
  invoiceId: string;
  accountId: string;
  workspaceId: string | null;
  tenantId: string | null;
  periodId: string;
  currency: "USD";
  subtotalUsd: number;
  taxUsd: number;
  totalUsd: number;
  status: BillingInvoiceStatus;
  summaryJson: string;
  externalInvoiceRef: string | null;
  dueAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Billing payment session record
// ---------------------------------------------------------------------------

/**
 * Billing payment session record - tracks third-party payment gateway checkout sessions.
 *
 * When a user initiates payment, a session is created with the payment gateway
 * (Stripe, Paddle). This tracks checkout URL, session state, and settlement.
 */
export interface BillingPaymentSessionRecord {
  sessionId: string;
  invoiceId: string;
  accountId: string;
  gatewayKind: BillingPaymentGatewayKind;
  gatewaySessionRef: string;
  checkoutUrl: string;
  status: BillingPaymentSessionStatus;
  amountUsd: number;
  currency: "USD";
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settledAt: Timestamp | null;
  failureCode: string | null;
}

// ---------------------------------------------------------------------------
// Usage event record
// ---------------------------------------------------------------------------

/**
 * Usage event record - granular tracking of resource consumption for billing.
 *
 * Every billable action (API calls, task executions, storage usage) generates
 * a usage event. Events are aggregated into invoices and reconciled against quotas.
 *
 * Canonical runtime attribution is anchored on HarnessRun / NodeRun / NodeAttempt.
 * Legacy executionId / stepId fields remain for projection compatibility only.
 */
export interface UsageEventRecord {
  usageId: string;
  accountId: string;
  subjectId: string;
  workspaceId: string | null;
  tenantId: string | null;
  taskId: string | null;
  harnessRunId?: string | null;
  nodeRunId?: string | null;
  attemptId?: string | null;
  /** @deprecated legacy projection identifier; use harnessRunId */
  executionId: string | null;
  /** @deprecated legacy projection identifier; use nodeRunId */
  stepId: string | null;
  metricType: string;
  quantity: number;
  source: BillingUsageSource;
  unitPriceUsd: number;
  capturedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Quota counter record
// ---------------------------------------------------------------------------

/**
 * Quota counter record - tracks usage against limits within a time window.
 *
 * Implements sliding window quotas for rate limiting. Tracks used vs. allowed
 * quantity with configurable reset policies (e.g., calendar month).
 */
export interface QuotaCounterRecord {
  counterId: string;
  accountId: string;
  metricType: string;
  windowStart: Timestamp;
  windowEnd: Timestamp;
  usedQuantity: number;
  limitQuantity: number | null;
  limitType: BillingLimitType | null;
  resetPolicy: BillingResetPolicy | null;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Ledger entry record
// ---------------------------------------------------------------------------

/**
 * Ledger entry record - immutable financial transaction in the billing ledger.
 *
 * Records every charge, credit, adjustment, or refund. Entries are immutable
 * and together form a complete audit trail of all billing transactions.
 */
export interface LedgerEntryRecord {
  entryId: string;
  accountId: string;
  usageId: string | null;
  periodId: string;
  entryType: "usage_charge" | "adjustment" | "credit" | "refund";
  amountUsd: number;
  currency: "USD";
  sourceRef: string | null;
  recordedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Entitlement decision record
// ---------------------------------------------------------------------------

/**
 * Entitlement decision record - result of checking feature access against policy.
 *
 * When a feature is accessed, the entitlement service evaluates policies and
 * records the decision (allow, deny, degrade, warn) with the reason and
 * policy version for audit and debugging.
 */
export interface EntitlementDecisionRecord {
  decisionId: string;
  accountId: string;
  featureKey: string;
  metricType: string | null;
  requestedQuantity: number | null;
  allowed: number;
  decisionType: EntitlementDecisionType;
  reasonCode: string;
  policyVersion: string;
  evaluatedAt: Timestamp;
}
