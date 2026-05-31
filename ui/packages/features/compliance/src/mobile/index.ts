import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createComplianceMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.compliance.mobile.standards.title"),
      translateMessage("ui.compliance.mobile.standards.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.compliance.mobile.checks.title"),
      translateMessage("ui.compliance.mobile.checks.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.compliance.mobile.passing.title"),
      translateMessage("ui.compliance.mobile.passing.description"),
    ),
  ] as const;
}
