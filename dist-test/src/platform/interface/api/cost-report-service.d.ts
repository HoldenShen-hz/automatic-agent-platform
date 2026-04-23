export interface CostReportResourceCost {
    readonly resourceId: string;
    readonly resourceType: "compute" | "storage" | "network" | "api";
    readonly costUsd: number;
    readonly currency: string;
    readonly metadata?: Record<string, unknown>;
}
export interface CostReportRecord {
    readonly reportId: string;
    readonly tenantId: string | null;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly totalCostUsd: number;
    readonly currency: string;
    readonly resourceCosts: readonly CostReportResourceCost[];
    readonly resourceCount: number;
    readonly submittedBy: string;
    readonly submittedAt: string;
    readonly createdAt: string;
}
export interface BudgetSummaryRecord {
    readonly budgetKey: string;
    readonly tenantId: string | null;
    readonly currency: string;
    readonly totalCostUsd: number;
    readonly reportCount: number;
    readonly latestSubmittedAt: string;
    readonly periodStart: string;
    readonly periodEnd: string;
}
export interface CreateCostReportInput {
    readonly tenantId?: string | null;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly totalCostUsd: number;
    readonly currency?: string;
    readonly resourceCosts: readonly CostReportResourceCost[];
    readonly submittedBy: string;
    readonly submittedAt?: string;
}
export declare class CostReportService {
    private readonly reports;
    createReport(input: CreateCostReportInput): CostReportRecord;
    listReports(limit?: number, tenantId?: string | null): CostReportRecord[];
    listBudgetSummaries(limit?: number, tenantId?: string | null): BudgetSummaryRecord[];
}
