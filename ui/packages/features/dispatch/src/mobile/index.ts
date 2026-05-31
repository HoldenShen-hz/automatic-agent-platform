import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createDispatchMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.dispatch.mobile.queue.title"),
      translateMessage("ui.dispatch.mobile.queue.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.dispatch.mobile.replay.title"),
      translateMessage("ui.dispatch.mobile.replay.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.dispatch.mobile.escalation.title"),
      translateMessage("ui.dispatch.mobile.escalation.description"),
    ),
  ] as const;
}
