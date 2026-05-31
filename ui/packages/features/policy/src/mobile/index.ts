import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createPolicyMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.policy.mobile.approval.title"),
      translateMessage("ui.policy.mobile.approval.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.policy.mobile.action.title"),
      translateMessage("ui.policy.mobile.action.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.policy.mobile.visibility.title"),
      translateMessage("ui.policy.mobile.visibility.description"),
    ),
  ] as const;
}
