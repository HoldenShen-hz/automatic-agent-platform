export function resolveTriggerActionMode(requireConfirmation: boolean, riskLevel: "low" | "medium" | "high" | "critical"): "suggest" | "auto_execute" | "silent_record" {
  if (requireConfirmation) {
    return "suggest";
  }
  // §41.1: Critical risk actions always require human confirmation — silent_record is not permitted
  if (riskLevel === "critical") {
    return "suggest";
  }
  // §41.1: medium/high risk proactive actions cannot auto_execute
  if (riskLevel === "high" || riskLevel === "medium") {
    return "suggest";
  }
  // §41.1: low risk non-confirmation-required actions may proceed without user involvement
  return "auto_execute";
}
