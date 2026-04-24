import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useWorkflowDebuggerVm } from "../hooks";

export function WorkflowDebuggerWebView(): ReactElement {
  const vm = useWorkflowDebuggerVm();
  return (
    <FeatureScaffold title="Workflow Debugger" summary="调试器、时间线和数据流回放" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "debugger-replay", label: "回放时间线", tone: "accent" },
          { id: "debugger-failure", label: "定位失败阶段", tone: "neutral" },
          { id: "debugger-export", label: "导出调试快照", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
