import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { WorkflowDTO } from "@aa/shared-types";

export function createWorkflowCockpitMobileCards(workflows: readonly WorkflowDTO[]) {
  return workflows.slice(0, 3).map((workflow) => createMobileFeatureCard(
    workflow.title,
    `${workflow.status} · ${workflow.currentStage}`,
    workflow.owner,
  ));
}
