export function allocateReservedCapacity(totalUnits, allocations) {
    return allocations.reduce((acc, item) => {
        acc[item.tierId] = Math.floor(totalUnits * (item.reservedPercent / 100));
        return acc;
    }, {});
}
//# sourceMappingURL=index.js.map