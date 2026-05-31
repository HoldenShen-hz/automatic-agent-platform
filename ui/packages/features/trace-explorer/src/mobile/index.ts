import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createTraceExplorerMobileCards() {
  return [
    createMobileFeatureCard(translateMessage("ui.traceExplorer.mobile.trace.title"), translateMessage("ui.traceExplorer.mobile.trace.description")),
    createMobileFeatureCard(translateMessage("ui.traceExplorer.mobile.restricted.title"), translateMessage("ui.traceExplorer.mobile.restricted.description")),
  ];
}
