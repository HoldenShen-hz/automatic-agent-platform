import { useCostReportsQuery } from "@aa/shared-state";
import type { CostReportDTO } from "@aa/shared-types";

export interface CostCenterVm {
  readonly items: readonly { title: string; description: string }[];
}

export function mapCostReportsToVm(reports: readonly CostReportDTO[]): CostCenterVm {
  return {
    items: reports.map((report) => ({
      title: `${report.scope} · $${report.amountUsd}`,
      description: `Budget $${report.budgetUsd}`,
    })),
  };
}

export function useCostCenterVm(): CostCenterVm {
  return mapCostReportsToVm(useCostReportsQuery().data ?? []);
}
