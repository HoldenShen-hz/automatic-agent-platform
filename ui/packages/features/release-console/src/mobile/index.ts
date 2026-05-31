import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createReleaseConsoleMobileCards() {
  return [
    createMobileFeatureCard(translateMessage("ui.releaseConsole.mobile.console.title"), translateMessage("ui.releaseConsole.mobile.console.description")),
    createMobileFeatureCard(translateMessage("ui.releaseConsole.mobile.rollback.title"), translateMessage("ui.releaseConsole.mobile.rollback.description")),
  ];
}
