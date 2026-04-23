import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useWorkflowDebuggerVm } from "../hooks";

export function WorkflowDebuggerWebView(): ReactElement {
  const vm = useWorkflowDebuggerVm();
  return (
    <FeatureScaffold title="Workflow Debugger" summary="调试器、时间线和数据流回放" status="Planned">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
