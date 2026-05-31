import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createGovernanceComplianceMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.governanceCompliance.mobile.score.title"),
      translateMessage("ui.governanceCompliance.mobile.score.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.governanceCompliance.mobile.redaction.title"),
      translateMessage("ui.governanceCompliance.mobile.redaction.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.governanceCompliance.mobile.delegation.title"),
      translateMessage("ui.governanceCompliance.mobile.delegation.description"),
    ),
  ] as const;
}
