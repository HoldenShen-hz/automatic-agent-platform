export interface CostAttributionEntry {
    readonly subjectId: string;
    readonly amountUsd: number;
}
export declare function aggregateCostAttribution(entries: readonly CostAttributionEntry[]): Record<string, number>;
