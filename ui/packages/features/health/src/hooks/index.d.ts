export interface HealthVm {
    readonly loading: boolean;
    readonly errorMessage: string | null;
    readonly rows: readonly {
        key: string;
        value: string;
    }[];
    refresh(): Promise<void>;
}
export declare function useHealthVm(): HealthVm;
