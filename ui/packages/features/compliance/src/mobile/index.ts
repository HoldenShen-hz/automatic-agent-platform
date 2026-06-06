import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createComplianceMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.compliance.mobile.standards.title"),
      translateMessage("ui.compliance.mobile.standards.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.compliance.mobile.auditEvents.title"),
      translateMessage("ui.compliance.mobile.auditEvents.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.compliance.mobile.exceptionApprovalRate.title"),
      translateMessage("ui.compliance.mobile.exceptionApprovalRate.description"),
    ),
  ] as const;
}
