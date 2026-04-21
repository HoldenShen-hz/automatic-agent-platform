export function predictOpsCapacityRisk(currentLoad: number, projectedLoad: number): "low" | "medium" | "high" {
  const ratio = currentLoad === 0 ? projectedLoad : projectedLoad / currentLoad;
  if (ratio >= 2) return "high";
  if (ratio >= 1.2) return "medium";
  return "low";
}

export function estimateCapacityHeadroom(currentLoad: number, projectedLoad: number): number {
  if (projectedLoad <= 0) {
    return 0;
  }
  return Number((((projectedLoad - currentLoad) / projectedLoad) * 100).toFixed(2));
}
