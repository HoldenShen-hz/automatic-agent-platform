/**
 * AsyncCostManagementRepository - Async data access for cost management tables.
 *
 * Implements §26 storage layer - missing tables: cost_reports, budget_alerts, token_usage_daily
 */
import type { AsyncSqlConnection } from "../async-sql-database.js";
export interface CostReportRecord {
    reportId: string;
    tenantId: string | null;
    periodStart: string;
    periodEnd: string;
    totalCostUsd: number;
    currency: string;
    resourceCostsJson: string;
    submittedBy: string;
    submittedAt: string;
    createdAt: string;
}
export interface BudgetAlertRecord {
    alertId: string;
    tenantId: string | null;
    budgetType: string;
    thresholdUsd: number;
    currentSpendUsd: number;
    alertLevel: string;
    triggeredAt: string | null;
    acknowledgedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface TokenUsageDailyRecord {
    usageId: string;
    tenantId: string | null;
    packId: string | null;
    date: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    costUsd: number;
    stepId: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare class AsyncCostManagementRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertCostReport(report: CostReportRecord): Promise<void>;
    getCostReport(reportId: string): Promise<CostReportRecord | null>;
    listCostReportsByTenant(tenantId: string | null, limit?: number): Promise<CostReportRecord[]>;
    insertBudgetAlert(alert: BudgetAlertRecord): Promise<void>;
    updateBudgetAlert(input: {
        alertId: string;
        currentSpendUsd?: number;
        alertLevel?: string;
        triggeredAt?: string | null;
        acknowledgedAt?: string | null;
        updatedAt: string;
    }): Promise<number>;
    getBudgetAlert(alertId: string): Promise<BudgetAlertRecord | null>;
    listBudgetAlertsByTenant(tenantId: string | null): Promise<BudgetAlertRecord[]>;
    listActiveAlerts(): Promise<BudgetAlertRecord[]>;
    upsertTokenUsageDaily(usage: TokenUsageDailyRecord): Promise<void>;
    getTokenUsageDaily(usageId: string): Promise<TokenUsageDailyRecord | null>;
    listTokenUsageByTenantAndDate(tenantId: string | null, startDate: string, endDate: string): Promise<TokenUsageDailyRecord[]>;
    sumTokenCostsByTenant(tenantId: string, startDate: string, endDate: string): Promise<number>;
}
