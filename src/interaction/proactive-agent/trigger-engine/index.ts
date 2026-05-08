export function resolveTriggerActionMode(requireConfirmation: boolean, riskLevel: "low" | "medium" | "high" | "critical"): "suggest" | "auto_execute" | "silent_record" {
  if (requireConfirmation) {
    return "suggest";
  }
  if (riskLevel === "critical") {
    return "silent_record";
  }
  if (riskLevel === "high") {
    return "suggest";
  }
  return "auto_execute";
}
