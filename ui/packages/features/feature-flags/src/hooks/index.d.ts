import type { FeatureFlagDTO } from "@aa/shared-types";
export interface FeatureFlagsVm {
    readonly isLoading: boolean;
    readonly flags: readonly FeatureFlagDTO[];
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly items: readonly {
        readonly id: string;
        readonly title: string;
        readonly description: string;
        readonly detailRows: readonly {
            key: string;
            value: string;
        }[];
    }[];
}
export declare function useFeatureFlagsVm(): FeatureFlagsVm;
