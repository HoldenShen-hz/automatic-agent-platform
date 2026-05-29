import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createWorkflowCockpitMobileCards(workflows) {
    return workflows.slice(0, 3).map((workflow) => createMobileFeatureCard(workflow.title, `${workflow.status} · ${workflow.currentStage}`, workflow.owner));
}
