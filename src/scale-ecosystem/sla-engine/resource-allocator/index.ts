export interface ReservedCapacityAllocation {
  readonly tierId: string;
  readonly reservedPercent: number;
}

export function allocateReservedCapacity(totalUnits: number, allocations: readonly ReservedCapacityAllocation[]): Record<string, number> {
  // §187-2195: Validate that reservedPercent is within valid range [0, 100]
  // Previously only checked > 100, missing validation for negative values
  // and boundary case where total exactly equals 100
  let totalReservedPercent = 0;
  for (const allocation of allocations) {
    if (allocation.reservedPercent > 100) {
      throw new Error(`resource_allocator.reserved_percent_exceeds_100: tier=${allocation.tierId} percent=${allocation.reservedPercent}`);
    }
    if (allocation.reservedPercent < 0) {
      throw new Error(`resource_allocator.reserved_percent_negative: tier=${allocation.tierId} percent=${allocation.reservedPercent}`);
    }
    totalReservedPercent += allocation.reservedPercent;
  }
  // §187-2195: Changed from > 100 to >= 100 to catch exact 100% case
  // where tiers would exactly consume all physical capacity with no headroom
  if (totalReservedPercent >= 100) {
    throw new Error(`resource_allocator.total_reserved_exceeds_100: total=${totalReservedPercent}`);
  }
  return allocations.reduce<Record<string, number>>((acc, item) => {
    acc[item.tierId] = Math.floor(totalUnits * (item.reservedPercent / 100));
    return acc;
  }, {});
}
