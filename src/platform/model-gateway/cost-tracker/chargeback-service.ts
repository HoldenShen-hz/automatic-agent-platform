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
  readonly originalCurrency?: string;
  readonly baseCurrency?: string;
  /** R2-7: Foreign exchange rate applied when converting from original currency to USD */
  readonly fxRate: number;
  readonly fxRateToBase?: number;
  /** R2-7: Cost source attribution (e.g., "platform", "pack", "plugin") */
  readonly costSource: string;
  readonly costOriginal?: number;
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
    readonly baseCurrency?: string;
  } = {}): ChargebackReport {
    const reports = this.source.listReports(input.limit ?? 500, input.tenantId);
    const allocations = new Map<string, ChargebackAllocation>();
    const baseCurrency = input.baseCurrency ?? "USD";
    let totalCostUsd = 0;
    let firstCurrency = "USD";
    let hasMultipleCurrencies = false;

    for (const report of reports) {
      totalCostUsd += report.totalCostUsd * resolveFxRate(report.currency, baseCurrency);
      if (firstCurrency === "USD") {
        firstCurrency = report.currency;
      } else if (report.currency !== firstCurrency) {
        hasMultipleCurrencies = true;
      }
      for (const resource of report.resourceCosts) {
        // R2-7: Determine cost source attribution from resource metadata
        const costSource = (resource as { costSource?: string }).costSource ?? "platform";
        // R2-7: Use fxRate from resource if available, default to 1.0 (USD)
        const fxRate = (resource as { fxRate?: number }).fxRate ?? resolveFxRate(resource.currency, baseCurrency);
        const convertedCost = Number((resource.costUsd * fxRate).toFixed(4));
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
            originalCurrency: resource.currency,
            baseCurrency,
            fxRate,
            fxRateToBase: fxRate,
            costSource,
            costOriginal: resource.costUsd,
            costUsd: convertedCost,
            reportCount: 1,
            firstPeriodStart: report.periodStart,
            latestPeriodEnd: report.periodEnd,
          });
          continue;
        }
        allocations.set(allocationKey, {
          ...current,
          costOriginal: (current.costOriginal ?? current.costUsd) + resource.costUsd,
          costUsd: Number((current.costUsd + convertedCost).toFixed(4)),
          reportCount: current.reportCount + 1,
          firstPeriodStart: report.periodStart.localeCompare(current.firstPeriodStart) < 0 ? report.periodStart : current.firstPeriodStart,
          latestPeriodEnd: report.periodEnd.localeCompare(current.latestPeriodEnd) > 0 ? report.periodEnd : current.latestPeriodEnd,
        });
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      tenantId: input.tenantId ?? null,
      currency: input.baseCurrency ?? (hasMultipleCurrencies ? "MULTI" : firstCurrency),
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      reportCount: reports.length,
      allocations: [...allocations.values()].sort((left, right) => right.costUsd - left.costUsd),
    };
  }
}

function resolveFxRate(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) {
    return 1;
  }
  if (fromCurrency === "EUR" && toCurrency === "USD") {
    return 1.08;
  }
  return 1;
}
