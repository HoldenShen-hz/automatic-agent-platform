export interface ReservedCapacityAllocation {
  readonly tierId: string;
  readonly reservedPercent: number;
}

/**
 * Allocate reserved capacity across tiers.
 * Validates that total reservedPercent <= 100 before allocation.
 * @throws Error if total reservedPercent exceeds 100
 */
export function allocateReservedCapacity(totalUnits: number, allocations: readonly ReservedCapacityAllocation[]): Record<string, number> {
  const totalReservedPercent = allocations.reduce((sum, item) => sum + item.reservedPercent, 0);
  if (totalReservedPercent > 100) {
    throw new Error(`resource_allocator.reserved_capacity_exceeds_100: total reservedPercent=${totalReservedPercent} exceeds 100`);
  }
  return allocations.reduce<Record<string, number>>((acc, item) => {
    acc[item.tierId] = Math.floor(totalUnits * (item.reservedPercent / 100));
    return acc;
  }, {});
}
