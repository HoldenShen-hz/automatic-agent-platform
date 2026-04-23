import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { TaskDTO } from "@aa/shared-types";

export function createTaskCockpitMobileCards(tasks: readonly TaskDTO[]) {
  return tasks.slice(0, 3).map((task) => createMobileFeatureCard(
    task.title,
    `${task.status} · ${task.currentStep}`,
    task.domainId,
  ));
}
