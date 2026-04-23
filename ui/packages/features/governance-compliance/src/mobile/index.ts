import { createMobileFeatureCard } from "@aa/ui-mobile";

export function createGovernanceComplianceMobileCards() {
  return [
    createMobileFeatureCard("Compliance Score", "Cross-standard status"),
    createMobileFeatureCard("Redaction", "Field visibility and PII policy"),
    createMobileFeatureCard("Delegation", "Escalation and delegated governance"),
  ] as const;
}
