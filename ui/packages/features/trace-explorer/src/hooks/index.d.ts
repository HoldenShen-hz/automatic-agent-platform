export interface TraceExplorerVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useTraceExplorerVm(): TraceExplorerVm;
