declare const workflowCockpitFeature: import("@aa/ui-core").FeatureModule;
export default workflowCockpitFeature;
export { createWorkflowCockpitMobileCards } from "./mobile";
export { mapWorkflowsToVm, useWorkflowCockpitVm } from "./hooks";
export { WorkflowCockpitWebView } from "./web";
