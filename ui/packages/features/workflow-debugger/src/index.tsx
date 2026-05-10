import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { WorkflowDebuggerWebView } from "./web";

const featureCopy = translateFeatureCopy("workflow-debugger");

const workflowDebuggerFeature = createFeatureModule({
  id: "workflow-debugger",
  title: featureCopy.title,
  group: "Extended",
  path: "/extended/debugger",
  permission: "pack_developer+",
  status: "Planned",
  kind: "planned",
  summary: featureCopy.summary,
  render: WorkflowDebuggerWebView,
});

export default workflowDebuggerFeature;
export { createWorkflowDebuggerMobileCards } from "./mobile";
export { useWorkflowDebuggerVm } from "./hooks";
export { WorkflowDebuggerWebView } from "./web";
