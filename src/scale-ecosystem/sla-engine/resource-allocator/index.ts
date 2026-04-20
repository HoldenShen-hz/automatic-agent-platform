export interface ReservedCapacityAllocation {
  readonly tierId: string;
  readonly reservedPercent: number;
}

export function allocateReservedCapacity(totalUnits: number, allocations: readonly ReservedCapacityAllocation[]): Record<string, number> {
  return allocations.reduce<Record<string, number>>((acc, item) => {
    acc[item.tierId] = Math.floor(totalUnits * (item.reservedPercent / 100));
    return acc;
  }, {});
}
