import type { CostReportRecord, CostReportResourceCost } from "../../interface/api/cost-report-service.js";

export interface ChargebackReportSource {
  listReports(limit?: number, tenantId?: string | null): CostReportRecord[];
}

export interface ChargebackAllocation {
  readonly allocationKey: string;
  readonly tenantId: string | null;
  readonly resourceId: string;
  readonly resourceType: CostReportResourceCost["resourceType"];
  /** R2-7: Original currency for multi-currency chargeback */
  readonly currency: string;
  /** R2-7: Foreign exchange rate applied when converting from original currency to USD */
  readonly fxRate: number;
  /** R2-7: Cost source attribution (e.g., "platform", "pack", "plugin") */
  readonly costSource: string;
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
    const reports = this.source.listReports(input.limit ?? 500, input.tenantId);
    const allocations = new Map<string, ChargebackAllocation>();
    let firstCurrency = "USD";
    let hasMultipleCurrencies = false;

    for (const report of reports) {
      if (firstCurrency === "USD") {
        firstCurrency = report.currency;
      } else if (report.currency !== firstCurrency) {
        hasMultipleCurrencies = true;
      }
      for (const resource of report.resourceCosts) {
        // R2-7: Determine cost source attribution from resource metadata
        const costSource = (resource as { costSource?: string }).costSource ?? "platform";
        // R2-7: Use fxRate from resource if available, default to 1.0 (USD)
        const fxRate = (resource as { fxRate?: number }).fxRate ?? 1.0;
        const allocationKey = [
          report.tenantId ?? "platform",
          resource.resourceType,
          resource.resourceId,
          resource.currency,
          costSource,
        ].join(":");
        const current = allocations.get(allocationKey);
        if (current == null) {
          allocations.set(allocationKey, {
            allocationKey,
            tenantId: report.tenantId,
            resourceId: resource.resourceId,
            resourceType: resource.resourceType,
            currency: resource.currency,
            fxRate,
            costSource,
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

    // Compute totalCostUsd from allocations to avoid cross-currency summation
    const totalCostUsd = [...allocations.values()].reduce((sum, alloc) => sum + alloc.costUsd, 0);

    return {
      generatedAt: new Date().toISOString(),
      tenantId: input.tenantId ?? null,
      currency: hasMultipleCurrencies ? "MULTI" : firstCurrency,
      totalCostUsd,
      reportCount: reports.length,
      allocations: [...allocations.values()].sort((left, right) => right.costUsd - left.costUsd),
    };
  }
}
