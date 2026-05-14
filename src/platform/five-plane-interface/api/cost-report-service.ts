import { newId, nowIso } from "../../contracts/types/ids.js";

export interface CostReportResourceCost {
  readonly resourceId: string;
  readonly resourceType: "compute" | "storage" | "network" | "api";
  readonly costUsd: number;
  readonly currency: string;
  readonly metadata?: Record<string, unknown>;
  readonly domainId?: string;
  readonly teamId?: string;
  readonly orgId?: string;
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

export class CostReportService {
  private readonly reports = new Map<string, CostReportRecord>();

  public createReport(input: CreateCostReportInput): CostReportRecord {
    const createdAt = nowIso();
    const record: CostReportRecord = {
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

  public listReports(limit = 50, tenantId?: string | null): CostReportRecord[] {
    return [...this.reports.values()]
      .filter((report) => tenantId == null || report.tenantId === tenantId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .slice(0, Math.max(0, limit));
  }

  public computeDomainBreakdown(limit = 50, tenantId?: string | null): Array<{ dimensionType: "domain"; dimensionId: string; costUsd: number; percentageOfTotal: number }> {
    return this.computeBreakdown("domain", "domainId", limit, tenantId);
  }

  public computeTeamBreakdown(limit = 50, tenantId?: string | null): Array<{ dimensionType: "team"; dimensionId: string; costUsd: number; percentageOfTotal: number }> {
    return this.computeBreakdown("team", "teamId", limit, tenantId);
  }

  public computeOrgBreakdown(limit = 50, tenantId?: string | null): Array<{ dimensionType: "org"; dimensionId: string; costUsd: number; percentageOfTotal: number }> {
    return this.computeBreakdown("org", "orgId", limit, tenantId);
  }

  private computeBreakdown<TType extends "domain" | "team" | "org">(
    dimensionType: TType,
    field: "domainId" | "teamId" | "orgId",
    limit: number,
    tenantId?: string | null,
  ): Array<{ dimensionType: TType; dimensionId: string; costUsd: number; percentageOfTotal: number }> {
    const totals = new Map<string, number>();
    let grandTotal = 0;
    for (const report of this.reports.values()) {
      if (tenantId != null && report.tenantId !== tenantId) {
        continue;
      }
      for (const cost of report.resourceCosts) {
        const dimensionId = cost[field];
        if (typeof dimensionId !== "string" || dimensionId.trim().length === 0) {
          continue;
        }
        totals.set(dimensionId, (totals.get(dimensionId) ?? 0) + cost.costUsd);
        grandTotal += cost.costUsd;
      }
    }
    return [...totals.entries()]
      .map(([dimensionId, costUsd]) => ({
        dimensionType,
        dimensionId,
        costUsd,
        percentageOfTotal: grandTotal > 0 ? costUsd / grandTotal : 0,
      }))
      .sort((left, right) => right.costUsd - left.costUsd)
      .slice(0, Math.max(0, limit));
  }

  public listBudgetSummaries(limit = 50, tenantId?: string | null): BudgetSummaryRecord[] {
    const summaries = new Map<string, BudgetSummaryRecord>();
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
      const earliestPeriodStart = report.periodStart.localeCompare(current.periodStart) > 0 ? report.periodStart : current.periodStart;
      const latestPeriodEnd = report.periodEnd.localeCompare(current.periodEnd) > 0 ? report.periodEnd : current.periodEnd;
      summaries.set(key, {
        ...current,
        totalCostUsd: current.totalCostUsd + report.totalCostUsd,
        reportCount: current.reportCount + 1,
        latestSubmittedAt,
        periodStart: earliestPeriodStart,
        periodEnd: latestPeriodEnd,
      });
    }

    return [...summaries.values()]
      .sort((left, right) => right.latestSubmittedAt.localeCompare(left.latestSubmittedAt))
      .slice(0, Math.max(0, limit));
  }
}
