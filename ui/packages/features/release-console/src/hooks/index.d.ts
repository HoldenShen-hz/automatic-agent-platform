export interface ReleaseConsoleVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useReleaseConsoleVm(): ReleaseConsoleVm;
