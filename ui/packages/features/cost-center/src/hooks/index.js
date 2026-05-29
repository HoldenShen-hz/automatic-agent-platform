import { useCostReportsQuery } from "@aa/shared-state";
export function mapCostReportsToVm(reports) {
    return {
        items: reports.map((report) => ({
            title: `${report.scope} · $${report.amountUsd}`,
            description: `Budget $${report.budgetUsd}`,
        })),
    };
}
export function useCostCenterVm() {
    return mapCostReportsToVm(useCostReportsQuery().data ?? []);
}
