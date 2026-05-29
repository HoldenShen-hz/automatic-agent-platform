export interface HealthVm {
    readonly rows: readonly {
        key: string;
        value: string;
    }[];
}
export declare function useHealthVm(): HealthVm;
