declare const taskCockpitFeature: import("@aa/ui-core").FeatureModule;
export default taskCockpitFeature;
export { createTaskCockpitMobileCards } from "./mobile";
export { mapTasksToVm, useTaskCockpitVm } from "./hooks";
export { TaskCockpitWebView } from "./web";
