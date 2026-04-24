import type { CostReportRecord, CostReportResourceCost } from "../../interface/api/cost-report-service.js";

export interface ChargebackReportSource {
  listReports(limit?: number, tenantId?: string | null): CostReportRecord[];
}

export interface ChargebackAllocation {
  readonly allocationKey: string;
  readonly tenantId: string | null;
  readonly resourceId: string;
  readonly resourceType: CostReportResourceCost["resourceType"];
  readonly currency: string;
  readonly costUsd: number;
  readonly reportCount: number;
  readonly firstPeriodStart: string;
  readonly latestPeriodEnd: string;
}

export interface ChargebackReport {
  readonly generatedAt: string;
  readonly tenantId: string | null;
  readonly currency: string;
  readonly totalCostUsd: number;
  readonly reportCount: number;
  readonly allocations: readonly ChargebackAllocation[];
}

export class ChargebackService {
  public constructor(private readonly source: ChargebackReportSource) {}

  public buildReport(input: {
    readonly tenantId?: string | null;
    readonly limit?: number;
  } = {}): ChargebackReport {
    const reports = this.source.listReports(input.limit ?? 500, input.tenantId ?? undefined);
    const allocations = new Map<string, ChargebackAllocation>();
    let totalCostUsd = 0;
    let currency = "USD";

    for (const report of reports) {
      totalCostUsd += report.totalCostUsd;
      currency = report.currency;
      for (const resource of report.resourceCosts) {
        const allocationKey = [
          report.tenantId ?? "platform",
          resource.resourceType,
          resource.resourceId,
          resource.currency,
        ].join(":");
        const current = allocations.get(allocationKey);
        if (current == null) {
          allocations.set(allocationKey, {
            allocationKey,
            tenantId: report.tenantId,
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            currency: resource.currency,
            costUsd: resource.costUsd,
            reportCount: 1,
            firstPeriodStart: report.periodStart,
            latestPeriodEnd: report.periodEnd,
          });
          continue;
        }
        allocations.set(allocationKey, {
          ...current,
          costUsd: current.costUsd + resource.costUsd,
          reportCount: current.reportCount + 1,
          firstPeriodStart: report.periodStart.localeCompare(current.firstPeriodStart) < 0 ? report.periodStart : current.firstPeriodStart,
          latestPeriodEnd: report.periodEnd.localeCompare(current.latestPeriodEnd) > 0 ? report.periodEnd : current.latestPeriodEnd,
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      tenantId: input.tenantId ?? null,
      currency,
      totalCostUsd,
      reportCount: reports.length,
      allocations: [...allocations.values()].sort((left, right) => right.costUsd - left.costUsd),
    };
  }
}
