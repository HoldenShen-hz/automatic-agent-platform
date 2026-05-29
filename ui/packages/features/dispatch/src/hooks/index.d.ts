export interface DispatchVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useDispatchVm(): DispatchVm;
