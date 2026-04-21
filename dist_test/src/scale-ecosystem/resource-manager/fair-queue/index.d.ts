export interface FairQueueItem {
    readonly itemId: string;
    readonly tenantId: string;
    readonly priority: number;
    readonly ageMs: number;
}
export declare function orderFairQueue(items: readonly FairQueueItem[]): FairQueueItem[];
