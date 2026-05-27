import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useWorkflowDebuggerVm } from "../hooks";

export function WorkflowDebuggerWebView(): ReactElement {
  const vm = useWorkflowDebuggerVm();
  return (
    <FeatureScaffold title="Workflow Debugger" summary="调试器、时间线和数据流回放" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "debugger-replay", label: "回放时间线", tone: "accent", onTrigger: buildWorkbenchActionHandler("workflow-debugger", "replay", { deepLinkPath: "/extended/workflow-debugger?mode=replay" }) },
          { id: "debugger-failure", label: "定位失败阶段", tone: "neutral", onTrigger: buildWorkbenchActionHandler("workflow-debugger", "failure", { deepLinkPath: "/extended/workflow-debugger?view=failure" }) },
          { id: "debugger-export", label: "导出调试快照", tone: "neutral", onTrigger: buildWorkbenchActionHandler("workflow-debugger", "export", { copySelection: true }) },
        ]}
      />
    </FeatureScaffold>
  );
}
