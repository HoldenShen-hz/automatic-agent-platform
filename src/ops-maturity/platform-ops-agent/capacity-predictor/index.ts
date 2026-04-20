export function predictOpsCapacityRisk(currentLoad: number, projectedLoad: number): "low" | "medium" | "high" {
  const ratio = currentLoad === 0 ? projectedLoad : projectedLoad / currentLoad;
  if (ratio >= 2) return "high";
  if (ratio >= 1.2) return "medium";
  return "low";
}
