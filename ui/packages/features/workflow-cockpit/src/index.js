import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { WorkflowCockpitWebView } from "./web";
const featureCopy = translateFeatureCopy("workflow-cockpit");
const workflowCockpitFeature = createFeatureModule({
    id: "workflow-cockpit",
    title: featureCopy.title,
    group: "Mission Control",
    path: "/mission-control/workflows",
    permission: "pack_developer+",
    status: "Implemented/Internal",
    summary: featureCopy.summary,
    render: WorkflowCockpitWebView,
});
export default workflowCockpitFeature;
export { createWorkflowCockpitMobileCards } from "./mobile";
export { mapWorkflowsToVm, useWorkflowCockpitVm } from "./hooks";
export { WorkflowCockpitWebView } from "./web";
