import { createFeatureModule } from "@aa/ui-core";
import { WorkflowDebuggerWebView } from "./web";

const workflowDebuggerFeature = createFeatureModule({
  id: "workflow-debugger",
  title: "Workflow Debugger",
  group: "Extended",
  path: "/extended/debugger",
  permission: "pack_developer+",
  status: "Planned",
  kind: "planned",
  summary: "调试器、时间线和数据流回放。",
  render: WorkflowDebuggerWebView,
});

export default workflowDebuggerFeature;
export { createWorkflowDebuggerMobileCards } from "./mobile";
export { useWorkflowDebuggerVm } from "./hooks";
export { WorkflowDebuggerWebView } from "./web";
