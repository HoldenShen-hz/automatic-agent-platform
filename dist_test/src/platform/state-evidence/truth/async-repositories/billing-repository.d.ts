/**
 * AsyncBillingRepository - Async data access for billing, payments, quotas, and usage.
 *
 * This is the async PostgreSQL-compatible version of BillingRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { BillingAccountRecord, BillingInvoiceRecord, BillingPaymentSessionRecord, CostEventRecord, EntitlementDecisionRecord, LedgerEntryRecord, QuotaCounterRecord, UsageEventRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncBillingRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertCostEvent(costEvent: CostEventRecord): Promise<void>;
    listCostEventsByTask(taskId: string, tenantId?: string | null): Promise<CostEventRecord[]>;
    sumCostByTask(taskId: string, tenantId?: string | null): Promise<number>;
    upsertBillingAccount(account: BillingAccountRecord): Promise<void>;
    insertBillingInvoice(invoice: BillingInvoiceRecord): Promise<void>;
    updateBillingInvoiceStatus(input: {
        invoiceId: string;
        status: BillingInvoiceRecord["status"];
        updatedAt: string;
        paidAt?: string | null;
        externalInvoiceRef?: string | null;
    }): Promise<number>;
    insertBillingPaymentSession(session: BillingPaymentSessionRecord): Promise<void>;
    updateBillingPaymentSessionStatus(input: {
        sessionId: string;
        status: BillingPaymentSessionRecord["status"];
        updatedAt: string;
        settledAt?: string | null;
        failureCode?: string | null;
    }): Promise<number>;
    insertUsageEvent(event: UsageEventRecord): Promise<void>;
    upsertQuotaCounter(counter: QuotaCounterRecord): Promise<void>;
    insertLedgerEntry(entry: LedgerEntryRecord): Promise<void>;
    insertEntitlementDecision(decision: EntitlementDecisionRecord): Promise<void>;
    getBillingAccount(accountId: string): Promise<BillingAccountRecord | null>;
    countActiveExecutionsByTenant(tenantId: string): Promise<number>;
    countQueuedTasksByTenant(tenantId: string): Promise<number>;
}
