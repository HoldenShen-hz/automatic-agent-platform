import { newId, nowIso } from "../../contracts/types/ids.js";

// §53.1: Cost breakdown by domain, team, and org for business unit attribution
export interface CostBreakdownByDimension {
  readonly dimensionType: "domain" | "team" | "org";
  readonly dimensionId: string;
  readonly dimensionName: string;
  readonly costUsd: number;
  readonly percentageOfTotal: number;
}

export interface CostReportResourceCost {
  readonly resourceId: string;
  readonly resourceType: "compute" | "storage" | "network" | "api";
  readonly costUsd: number;
  readonly currency: string;
  // §53.1: Cost attribution dimensions
  readonly domainId?: string | null;
  readonly teamId?: string | null;
  readonly orgId?: string | null;
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
  // §53.1: Cost breakdown by business unit dimensions
  readonly domainBreakdown?: readonly CostBreakdownByDimension[];
  readonly teamBreakdown?: readonly CostBreakdownByDimension[];
  readonly orgBreakdown?: readonly CostBreakdownByDimension[];
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
    return Array.from(this.reports.values())
      .filter((report) => tenantId == null || report.tenantId === tenantId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .slice(0, Math.max(0, limit));
  }

  public listBudgetSummaries(limit = 50, tenantId?: string | null): BudgetSummaryRecord[] {
    const summaries = new Map<string, BudgetSummaryRecord>();
    this.reports.forEach((report) => {
      if (tenantId != null && report.tenantId !== tenantId) {
        return;
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
        return;
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
    });

    return Array.from(summaries.values())
      .sort((left, right) => right.latestSubmittedAt.localeCompare(left.latestSubmittedAt))
      .slice(0, Math.max(0, limit));
  }

  /**
   * Compute cost breakdown by domain.
   * §53.1: Aggregates costs by domain for business unit attribution.
   */
  public computeDomainBreakdown(limit = 50, tenantId?: string | null): CostBreakdownByDimension[] {
    const totalsByDomain = new Map<string, { name: string; cost: number }>();

    this.reports.forEach((report) => {
      if (tenantId != null && report.tenantId !== tenantId) {
        return;
      }
      for (const resource of report.resourceCosts) {
        if (resource.domainId != null) {
          const current = totalsByDomain.get(resource.domainId) ?? { name: resource.domainId, cost: 0 };
          totalsByDomain.set(resource.domainId, {
            name: current.name,
            cost: current.cost + resource.costUsd,
          });
        }
      }
    });

    const totalCost = Array.from(totalsByDomain.values()).reduce((sum, d) => sum + d.cost, 0);
    return Array.from(totalsByDomain.entries())
      .map(([dimensionId, { name, cost }]) => ({
        dimensionType: "domain" as const,
        dimensionId,
        dimensionName: name,
        costUsd: cost,
        percentageOfTotal: totalCost > 0 ? cost / totalCost : 0,
      }))
      .sort((left, right) => right.costUsd - left.costUsd)
      .slice(0, Math.max(0, limit));
  }

  /**
   * Compute cost breakdown by team.
   * §53.1: Aggregates costs by team for business unit attribution.
   */
  public computeTeamBreakdown(limit = 50, tenantId?: string | null): CostBreakdownByDimension[] {
    const totalsByTeam = new Map<string, { name: string; cost: number }>();

    this.reports.forEach((report) => {
      if (tenantId != null && report.tenantId !== tenantId) {
        return;
      }
      for (const resource of report.resourceCosts) {
        if (resource.teamId != null) {
          const current = totalsByTeam.get(resource.teamId) ?? { name: resource.teamId, cost: 0 };
          totalsByTeam.set(resource.teamId, {
            name: current.name,
            cost: current.cost + resource.costUsd,
          });
        }
      }
    });

    const totalCost = Array.from(totalsByTeam.values()).reduce((sum, d) => sum + d.cost, 0);
    return Array.from(totalsByTeam.entries())
      .map(([dimensionId, { name, cost }]) => ({
        dimensionType: "team" as const,
        dimensionId,
        dimensionName: name,
        costUsd: cost,
        percentageOfTotal: totalCost > 0 ? cost / totalCost : 0,
      }))
      .sort((left, right) => right.costUsd - left.costUsd)
      .slice(0, Math.max(0, limit));
  }

  /**
   * Compute cost breakdown by org.
   * §53.1: Aggregates costs by org for business unit attribution.
   */
  public computeOrgBreakdown(limit = 50, tenantId?: string | null): CostBreakdownByDimension[] {
    const totalsByOrg = new Map<string, { name: string; cost: number }>();

    this.reports.forEach((report) => {
      if (tenantId != null && report.tenantId !== tenantId) {
        return;
      }
      for (const resource of report.resourceCosts) {
        if (resource.orgId != null) {
          const current = totalsByOrg.get(resource.orgId) ?? { name: resource.orgId, cost: 0 };
          totalsByOrg.set(resource.orgId, {
            name: current.name,
            cost: current.cost + resource.costUsd,
          });
        }
      }
    });

    const totalCost = Array.from(totalsByOrg.values()).reduce((sum, d) => sum + d.cost, 0);
    return Array.from(totalsByOrg.entries())
      .map(([dimensionId, { name, cost }]) => ({
        dimensionType: "org" as const,
        dimensionId,
        dimensionName: name,
        costUsd: cost,
        percentageOfTotal: totalCost > 0 ? cost / totalCost : 0,
      }))
      .sort((left, right) => right.costUsd - left.costUsd)
      .slice(0, Math.max(0, limit));
  }
}
