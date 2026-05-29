import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { TaskCockpitWebView } from "./web";
const featureCopy = translateFeatureCopy("task-cockpit");
const taskCockpitFeature = createFeatureModule({
    id: "task-cockpit",
    title: featureCopy.title,
    group: "Mission Control",
    path: "/mission-control/tasks",
    permission: "authenticated",
    status: "Implemented/Contracted",
    summary: featureCopy.summary,
    render: TaskCockpitWebView,
});
export default taskCockpitFeature;
export { createTaskCockpitMobileCards } from "./mobile";
export { mapTasksToVm, useTaskCockpitVm } from "./hooks";
export { TaskCockpitWebView } from "./web";
