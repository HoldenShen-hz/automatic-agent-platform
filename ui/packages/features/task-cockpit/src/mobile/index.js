import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createTaskCockpitMobileCards(tasks) {
    return tasks.slice(0, 3).map((task) => createMobileFeatureCard(task.title, `${task.status} · ${task.currentStep}`, task.domainId));
}
