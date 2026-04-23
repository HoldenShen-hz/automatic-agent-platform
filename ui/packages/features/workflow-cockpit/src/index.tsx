import { createFeatureModule } from "@aa/ui-core";
import { WorkflowCockpitWebView } from "./web";

const workflowCockpitFeature = createFeatureModule({
  id: "workflow-cockpit",
  title: "Workflow Cockpit",
  group: "Mission Control",
  path: "/mission-control/workflows",
  permission: "pack_developer+",
  status: "Implemented/Internal",
  summary: "工作流 DAG、步骤和恢复基线视图。",
  render: WorkflowCockpitWebView,
});

export default workflowCockpitFeature;
export { createWorkflowCockpitMobileCards } from "./mobile";
export { mapWorkflowsToVm, useWorkflowCockpitVm } from "./hooks";
export { WorkflowCockpitWebView } from "./web";
