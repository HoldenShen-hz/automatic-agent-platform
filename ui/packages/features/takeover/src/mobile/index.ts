import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createTakeoverMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.takeover.mobile.takeover.title"),
      translateMessage("ui.takeover.mobile.takeover.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.takeover.mobile.override.title"),
      translateMessage("ui.takeover.mobile.override.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.takeover.mobile.resume.title"),
      translateMessage("ui.takeover.mobile.resume.description"),
    ),
  ] as const;
}
