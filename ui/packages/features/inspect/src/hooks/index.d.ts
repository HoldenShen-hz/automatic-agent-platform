export interface InspectVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useInspectVm(): InspectVm;
