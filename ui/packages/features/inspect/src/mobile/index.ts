import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createInspectMobileCards() {
  return [
    createMobileFeatureCard(translateMessage("ui.inspect.mobile.snapshot.title"), translateMessage("ui.inspect.mobile.snapshot.description")),
    createMobileFeatureCard(translateMessage("ui.inspect.mobile.toolTrace.title"), translateMessage("ui.inspect.mobile.toolTrace.description")),
    createMobileFeatureCard(translateMessage("ui.inspect.mobile.evidence.title"), translateMessage("ui.inspect.mobile.evidence.description")),
  ] as const;
}
