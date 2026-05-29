export interface ComplianceVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly rows: readonly {
        key: string;
        value: string;
    }[];
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useComplianceVm(): ComplianceVm;
