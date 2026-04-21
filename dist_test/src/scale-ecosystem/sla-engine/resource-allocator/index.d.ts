export interface ReservedCapacityAllocation {
    readonly tierId: string;
    readonly reservedPercent: number;
}
export declare function allocateReservedCapacity(totalUnits: number, allocations: readonly ReservedCapacityAllocation[]): Record<string, number>;
