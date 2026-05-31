import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";

export function createWorkflowBuilderMobileCards() {
  return [
    createMobileFeatureCard(
      translateMessage("ui.workflowBuilder.mobile.palette.title"),
      translateMessage("ui.workflowBuilder.mobile.palette.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.workflowBuilder.mobile.canvas.title"),
      translateMessage("ui.workflowBuilder.mobile.canvas.description"),
    ),
    createMobileFeatureCard(
      translateMessage("ui.workflowBuilder.mobile.validation.title"),
      translateMessage("ui.workflowBuilder.mobile.validation.description"),
    ),
  ] as const;
}
