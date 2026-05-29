import type { CostReportDTO } from "@aa/shared-types";
export interface CostCenterVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function mapCostReportsToVm(reports: readonly CostReportDTO[]): CostCenterVm;
export declare function useCostCenterVm(): CostCenterVm;
