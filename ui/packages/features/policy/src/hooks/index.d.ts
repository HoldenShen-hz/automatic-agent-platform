export interface PolicyVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function usePolicyVm(): PolicyVm;
