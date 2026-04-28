export function resolveTriggerActionMode(requireConfirmation: boolean, riskLevel: "low" | "medium" | "high" | "critical"): "suggest" | "auto_execute" | "silent_record" {
  if (requireConfirmation) {
    return "suggest";
  }
  if (riskLevel === "critical") {
    return "silent_record";
  }
  // §41.1: medium/high risk proactive actions cannot auto_execute
  if (riskLevel === "high" || riskLevel === "medium") {
    return "suggest";
  }
  return "auto_execute";
}
