export function resolveTriggerActionMode(requireConfirmation: boolean, riskLevel: "low" | "medium" | "high" | "critical"): "suggest" | "auto_execute" | "silent_record" {
  if (requireConfirmation) {
    return "suggest";
  }
  // R16-04 FIX: Critical risk actions always require human confirmation — silent_record is not permitted.
  // This enforces the autonomy boundary: critical actions cannot proceed without user involvement.
  if (riskLevel === "critical") {
    return "suggest";
  }
  // R16-04 FIX: medium/high risk proactive actions cannot auto_execute without user confirmation.
  // silent_record is only permitted for low-risk, non-confirmation-required actions.
  if (riskLevel === "high" || riskLevel === "medium") {
    return "suggest";
  }
  // R16-04 FIX: low risk non-confirmation-required actions may proceed without user involvement.
  return "auto_execute";
}
