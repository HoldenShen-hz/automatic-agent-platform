import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { WorkflowBuilderWebView } from "./web";
const featureCopy = translateFeatureCopy("workflow-builder");
const workflowBuilderFeature = createFeatureModule({
    id: "workflow-builder",
    title: featureCopy.title,
    group: "Extended",
    path: "/extended/workflow-builder",
    permission: "pack_developer+",
    status: "Planned",
    summary: featureCopy.summary,
    render: WorkflowBuilderWebView,
});
export default workflowBuilderFeature;
export { createWorkflowBuilderMobileCards } from "./mobile";
export { useWorkflowBuilderVm } from "./hooks";
export { WorkflowBuilderWebView } from "./web";
