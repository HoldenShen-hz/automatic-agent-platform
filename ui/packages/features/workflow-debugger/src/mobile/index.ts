import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createWorkflowDebuggerMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.workflowDebugger.mobile.timeline.title"),
      translateMessage("ui.workflowDebugger.mobile.timeline.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.workflowDebugger.mobile.stepIn.title"),
      translateMessage("ui.workflowDebugger.mobile.stepIn.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.workflowDebugger.mobile.timeTravel.title"),
      translateMessage("ui.workflowDebugger.mobile.timeTravel.description"),
    ),
  ] as const;
}
