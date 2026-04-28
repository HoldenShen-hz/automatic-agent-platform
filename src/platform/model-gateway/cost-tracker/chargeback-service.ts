import type { CostReportRecord, CostReportResourceCost } from "../../interface/api/cost-report-service.js";

export interface ChargebackReportSource {
  listReports(limit?: number, tenantId?: string | null): CostReportRecord[];
}

export interface ChargebackAllocation {
  readonly allocationKey: string;
  readonly tenantId: string | null;
  readonly resourceId: string;
  readonly resourceType: CostReportResourceCost["resourceType"];
  readonly originalCurrency: string;
  readonly baseCurrency: string;
  readonly fxRateToBase: number;
  readonly costOriginal: number;
  readonly costUsd: number;
  /** §18.7: Cost source for multi-currency attribution (e.g., "api_call", "token", "compute") */
  readonly costSource: string;
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

/**
 * FX rates cache - in production would be fetched from a rate service.
 * Maps currency code to USD conversion rate.
 */
const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CNY: 0.14,
  // Add more currencies as needed
};

/**
 * Gets the FX rate for converting a currency to USD.
 * In production, this would use a real FX rate service.
 */
function getFxRateToUsd(currency: string): number {
  return FX_RATES[currency] ?? 1.0;
}

/**
 * Converts an amount from one currency to another using FX rates.
 */
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  // Convert to USD first, then to target currency
  const amountInUsd = amount * getFxRateToUsd(fromCurrency);
  const targetRate = getFxRateToUsd(toCurrency);
  if (targetRate === 0) {
    return amountInUsd;
  }
  return amountInUsd / targetRate;
}

export class ChargebackService {
  public constructor(private readonly source: ChargebackReportSource) {}

  public buildReport(input: {
    readonly tenantId?: string | null;
    readonly limit?: number;
    readonly baseCurrency?: string;
  } = {}): ChargebackReport {
    const baseCurrency = input.baseCurrency ?? "USD";
    const reports = this.source.listReports(input.limit ?? 500, input.tenantId ?? undefined);
    const allocations = new Map<string, ChargebackAllocation>();
    let totalCostUsd = 0;
    let currency = baseCurrency;

    for (const report of reports) {
      // Convert report total to base currency
      const reportTotalInBase = convertCurrency(report.totalCostUsd, report.currency, baseCurrency);
      totalCostUsd += reportTotalInBase;
      currency = baseCurrency; // Report currency is now base currency

      for (const resource of report.resourceCosts) {
        // Convert resource cost to base currency
        const costInBase = convertCurrency(resource.costUsd, resource.currency, baseCurrency);

        // Snapshot the FX rate at time of report for audit
        const fxRate = getFxRateToUsd(resource.currency);

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
            originalCurrency: resource.currency,
            baseCurrency,
            fxRateToBase: fxRate,
            costOriginal: resource.costUsd,
            costUsd: costInBase,
            reportCount: 1,
            firstPeriodStart: report.periodStart,
            latestPeriodEnd: report.periodEnd,
          });
          continue;
        }
        allocations.set(allocationKey, {
          ...current,
          costOriginal: current.costOriginal + resource.costUsd,
          costUsd: current.costUsd + costInBase,
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
