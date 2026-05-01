export interface ReservedCapacityAllocation {
  readonly tierId: string;
  readonly reservedPercent: number;
}

export function allocateReservedCapacity(totalUnits: number, allocations: readonly ReservedCapacityAllocation[]): Record<string, number> {
  let totalReservedPercent = 0;
  for (const allocation of allocations) {
    if (allocation.reservedPercent > 100) {
      throw new Error(`resource_allocator.reserved_percent_exceeds_100: tier=${allocation.tierId} percent=${allocation.reservedPercent}`);
    }
    totalReservedPercent += allocation.reservedPercent;
  }
  if (totalReservedPercent > 100) {
    throw new Error(`resource_allocator.total_reserved_exceeds_100: total=${totalReservedPercent}`);
  }
  return allocations.reduce<Record<string, number>>((acc, item) => {
    acc[item.tierId] = Math.floor(totalUnits * (item.reservedPercent / 100));
    return acc;
  }, {});
}
