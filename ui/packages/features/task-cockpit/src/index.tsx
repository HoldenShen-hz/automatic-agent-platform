import { createFeatureModule } from "@aa/ui-core";
import { TaskCockpitWebView } from "./web";

const taskCockpitFeature = createFeatureModule({
  id: "task-cockpit",
  title: "Task Cockpit",
  group: "Mission Control",
  path: "/mission-control/tasks",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "任务五级下钻和三栏工作台基线。",
  render: TaskCockpitWebView,
});

export default taskCockpitFeature;
export { createTaskCockpitMobileCards } from "./mobile";
export { mapTasksToVm, useTaskCockpitVm } from "./hooks";
export { TaskCockpitWebView } from "./web";
