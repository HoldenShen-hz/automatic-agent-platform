import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useWorkflowDebuggerVm } from "../hooks";

export function WorkflowDebuggerWebView(): ReactElement {
  const featureCopy = translateFeatureCopy("workflow-debugger");
  const vm = useWorkflowDebuggerVm();
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
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
