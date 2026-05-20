export function resolveTriggerActionMode(requireConfirmation: boolean, riskLevel: "low" | "medium" | "high" | "critical"): "suggest" | "auto_execute" | "silent_record" {
  if (requireConfirmation) {
    return "suggest";
  }
  if (riskLevel === "critical") {
    return "suggest";
  }
  // R5-24 & R5-25: medium and high risk cannot auto_execute
  if (riskLevel === "high" || riskLevel === "medium") {
    return "suggest";
  }
  return "auto_execute";
}
