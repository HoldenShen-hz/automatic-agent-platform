export interface MemoryReviewVm {
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function useMemoryReviewVm(): MemoryReviewVm;
