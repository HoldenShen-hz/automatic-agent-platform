import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createAuditMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.audit.mobile.timeline.title"),
      translateMessage("ui.audit.mobile.timeline.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.audit.mobile.evidence.title"),
      translateMessage("ui.audit.mobile.evidence.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.audit.mobile.actor.title"),
      translateMessage("ui.audit.mobile.actor.description"),
    ),
  ] as const;
}
