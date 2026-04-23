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
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { BillingAccountRecord, BillingInvoiceRecord, BillingPaymentSessionRecord } from "../../platform/contracts/types/domain.js";
import type { BillingAccountSummary, BillingServiceOptions, CreateBillingAccountInput, CreateBillingCheckoutSessionInput, CreateBillingInvoiceInput, EvaluateEntitlementInput, EvaluateEntitlementResult, ExportBillingSummaryResult, ReconcileBillingPaymentSessionInput, ReconcilePendingPaymentSessionsInput, ReconcilePendingPaymentSessionsResult, RecordUsageInput, RecordUsageResult, SettleBillingPaymentSessionInput } from "./billing/types.js";
export type { BillingMetricType, PlanCatalogEntry } from "../../platform/control-plane/config-center/billing-plan-catalog.js";
export type { BillingAccountSummary, BillingServiceOptions, CreateBillingAccountInput, CreateBillingCheckoutSessionInput, CreateBillingInvoiceInput, EvaluateEntitlementInput, EvaluateEntitlementResult, ExportBillingSummaryResult, ReconcileBillingPaymentSessionInput, ReconcilePendingPaymentSessionsInput, ReconcilePendingPaymentSessionsResult, RecordUsageInput, RecordUsageResult, SettleBillingPaymentSessionInput, } from "./billing/types.js";
/**
 * Billing Service
 *
 * Central service for all billing operations: account management, entitlement
 * evaluation, usage recording, invoice creation, and payment reconciliation.
 */
export declare class BillingService {
    private readonly db;
    private readonly store;
    private readonly artifactStore;
    private readonly planCatalog;
    private readonly policyVersion;
    private readonly paymentGateway;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: BillingServiceOptions);
    /**
     * Creates a new billing account.
     * Account is associated with an owner (user) and optionally a workspace.
     * Initial status is active unless specified otherwise.
     */
    createAccount(input: CreateBillingAccountInput): BillingAccountRecord;
    /**
     * Evaluates whether an account is entitled to use a specific feature.
     *
     * Checks:
     * 1. Feature exists in the account's plan
     * 2. If metric-based, checks quota availability
     *
     * Returns a decision record with allow/deny/warn/degrade and remaining quota.
     */
    evaluateEntitlement(input: EvaluateEntitlementInput): EvaluateEntitlementResult;
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
    recordUsage(input: RecordUsageInput): RecordUsageResult;
    /**
     * Builds a summary of account state including quotas, usage, and ledger.
     * Used for reporting and invoice creation.
     */
    buildAccountSummary(accountId: string): BillingAccountSummary;
    /**
     * Exports account summary as JSON and Markdown artifacts.
     * Returns the summary and artifact references.
     */
    exportAccountSummary(accountId: string): ExportBillingSummaryResult;
    /**
     * Creates an invoice for an account.
     * Invoice aggregates all ledger entries from the account's most recent period.
     */
    createInvoice(input: CreateBillingInvoiceInput): BillingInvoiceRecord;
    /**
     * Creates a checkout session with the payment gateway.
     * Returns a session record with checkout URL for the customer.
     */
    createCheckoutSession(input: CreateBillingCheckoutSessionInput): Promise<BillingPaymentSessionRecord>;
    /**
     * Settles (completes) a payment session after successful payment.
     * Updates invoice and session status, creates credit ledger entry.
     */
    settlePaymentSession(input: SettleBillingPaymentSessionInput): {
        session: BillingPaymentSessionRecord;
        invoice: BillingInvoiceRecord;
    };
    /**
     * Reconciles a payment session from gateway webhook or status check.
     * Handles status updates (paid, failed, cancelled) and routes to settlement if paid.
     */
    reconcilePaymentSession(input: ReconcileBillingPaymentSessionInput): {
        session: BillingPaymentSessionRecord;
        invoice: BillingInvoiceRecord;
    };
    /**
     * Batch reconciles all pending payment sessions.
     *
     * Scans pending sessions, queries each gateway for current status,
     * and reconciles any that have changed status.
     *
     * Returns detailed results per session scanned.
     */
    reconcilePendingPaymentSessions(input?: ReconcilePendingPaymentSessionsInput): Promise<ReconcilePendingPaymentSessionsResult>;
    /** Lists invoices for an account */
    listInvoices(accountId: string, limit?: number, tenantId?: string | null): BillingInvoiceRecord[];
    /** Lists payment sessions for an invoice */
    listPaymentSessions(invoiceId: string, limit?: number, tenantId?: string | null): BillingPaymentSessionRecord[];
    /** Looks up a plan from the catalog, validates it exists */
    private getPlan;
    /** Requires an active account, throws if not found or not active */
    private requireActiveAccount;
    /** Requires an invoice, throws if not found */
    private requireInvoice;
    /** Requires a payment session, throws if not found */
    private requirePaymentSession;
    /**
     * Fetches payment session status from the gateway.
     * Returns null if gateway doesn't support status fetching or kind mismatch.
     */
    private fetchGatewayStatusSnapshot;
    /**
     * Ensures a placeholder task exists for billing artifact references.
     * Required because artifacts reference a task_id.
     */
    private ensureBillingArtifactTask;
}
