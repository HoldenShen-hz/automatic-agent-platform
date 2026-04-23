import { newId, nowIso } from "../../contracts/types/ids.js";
export class CostReportService {
    reports = new Map();
    createReport(input) {
        const createdAt = nowIso();
        const record = {
            reportId: newId("cost_report"),
            tenantId: input.tenantId ?? null,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            totalCostUsd: input.totalCostUsd,
            currency: input.currency ?? "USD",
            resourceCosts: [...input.resourceCosts],
            resourceCount: input.resourceCosts.length,
            submittedBy: input.submittedBy,
            submittedAt: input.submittedAt ?? createdAt,
            createdAt,
        };
        this.reports.set(record.reportId, record);
        return record;
    }
    listReports(limit = 50, tenantId) {
        return [...this.reports.values()]
            .filter((report) => tenantId == null || report.tenantId === tenantId)
            .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
            .slice(0, Math.max(0, limit));
    }
    listBudgetSummaries(limit = 50, tenantId) {
        const summaries = new Map();
        for (const report of this.reports.values()) {
            if (tenantId != null && report.tenantId !== tenantId) {
                continue;
            }
            const key = `${report.tenantId ?? "platform"}:${report.currency}`;
            const current = summaries.get(key);
            if (current == null) {
                summaries.set(key, {
                    budgetKey: key,
                    tenantId: report.tenantId,
                    currency: report.currency,
                    totalCostUsd: report.totalCostUsd,
                    reportCount: 1,
                    latestSubmittedAt: report.submittedAt,
                    periodStart: report.periodStart,
                    periodEnd: report.periodEnd,
                });
                continue;
            }
            const latestSubmittedAt = report.submittedAt.localeCompare(current.latestSubmittedAt) > 0 ? report.submittedAt : current.latestSubmittedAt;
            const latestPeriodStart = report.submittedAt.localeCompare(current.latestSubmittedAt) > 0 ? report.periodStart : current.periodStart;
            const latestPeriodEnd = report.submittedAt.localeCompare(current.latestSubmittedAt) > 0 ? report.periodEnd : current.periodEnd;
            summaries.set(key, {
                ...current,
                totalCostUsd: current.totalCostUsd + report.totalCostUsd,
                reportCount: current.reportCount + 1,
                latestSubmittedAt,
                periodStart: latestPeriodStart,
                periodEnd: latestPeriodEnd,
            });
        }
        return [...summaries.values()]
            .sort((left, right) => right.latestSubmittedAt.localeCompare(left.latestSubmittedAt))
            .slice(0, Math.max(0, limit));
    }
}
//# sourceMappingURL=cost-report-service.js.map