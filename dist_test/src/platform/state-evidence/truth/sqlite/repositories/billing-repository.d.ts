/**
 * BillingRepository - Data access for billing, payments, quotas, and usage.
 */
import type { BillingAccountRecord, BillingInvoiceRecord, BillingPaymentSessionRecord, CostEventRecord, EntitlementDecisionRecord, LedgerEntryRecord, QuotaCounterRecord, UsageEventRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class BillingRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertCostEvent(costEvent: CostEventRecord): void;
    listCostEventsByTask(taskId: string, tenantId?: string | null): CostEventRecord[];
    sumCostByTask(taskId: string, tenantId?: string | null): number;
    upsertBillingAccount(account: BillingAccountRecord): void;
    insertBillingInvoice(invoice: BillingInvoiceRecord): void;
    updateBillingInvoiceStatus(input: {
        invoiceId: string;
        status: BillingInvoiceRecord["status"];
        updatedAt: string;
        paidAt?: string | null;
        externalInvoiceRef?: string | null;
    }): void;
    insertBillingPaymentSession(session: BillingPaymentSessionRecord): void;
    updateBillingPaymentSessionStatus(input: {
        sessionId: string;
        status: BillingPaymentSessionRecord["status"];
        updatedAt: string;
        settledAt?: string | null;
        failureCode?: string | null;
    }): void;
    insertUsageEvent(event: UsageEventRecord): void;
    upsertQuotaCounter(counter: QuotaCounterRecord): void;
    insertLedgerEntry(entry: LedgerEntryRecord): void;
    insertEntitlementDecision(decision: EntitlementDecisionRecord): void;
    getBillingAccount(accountId: string): BillingAccountRecord | null;
    listBillingAccounts(limit?: number): BillingAccountRecord[];
    getBillingInvoice(invoiceId: string, tenantId?: string | null): BillingInvoiceRecord | null;
    listBillingInvoicesForAccount(accountId: string, limit?: number, tenantId?: string | null): BillingInvoiceRecord[];
    getBillingPaymentSession(sessionId: string, tenantId?: string | null): BillingPaymentSessionRecord | null;
    getBillingPaymentSessionByGatewayRef(gatewayKind: BillingPaymentSessionRecord["gatewayKind"], gatewaySessionRef: string, tenantId?: string | null): BillingPaymentSessionRecord | null;
    listBillingPaymentSessionsForInvoice(invoiceId: string, limit?: number, tenantId?: string | null): BillingPaymentSessionRecord[];
    listBillingPaymentSessions(options?: {
        status?: BillingPaymentSessionRecord["status"] | null;
        gatewayKind?: BillingPaymentSessionRecord["gatewayKind"] | null;
        tenantId?: string | null;
        limit?: number;
    }): BillingPaymentSessionRecord[];
    getQuotaCounter(accountId: string, metricType: string, windowStart: string, windowEnd: string): QuotaCounterRecord | null;
    listQuotaCounters(accountId: string): QuotaCounterRecord[];
    listUsageEventsForAccount(accountId: string, limit?: number): UsageEventRecord[];
    listLedgerEntriesForAccount(accountId: string, limit?: number): LedgerEntryRecord[];
    listEntitlementDecisionsForAccount(accountId: string, limit?: number): EntitlementDecisionRecord[];
    /**
     * Count active executions for a tenant (used for quota tracking).
     */
    countActiveExecutionsByTenant(tenantId: string): number;
    /**
     * List recent executions for a tenant.
     */
    listRecentExecutionsByTenant(tenantId: string, limit?: number): unknown[];
    /**
     * Update task status (helper for billing-related operations).
     */
    updateTaskStatus(taskId: string, status: string, updatedAt: string): void;
    /**
     * Get task by ID.
     */
    getTask(taskId: string): unknown | undefined;
    /**
     * Count queued tasks for a tenant.
     */
    countQueuedTasksByTenant(tenantId: string): number;
    /**
     * List queued tasks for a tenant.
     */
    listQueuedTasksByTenant(tenantId: string, limit?: number): unknown[];
}
