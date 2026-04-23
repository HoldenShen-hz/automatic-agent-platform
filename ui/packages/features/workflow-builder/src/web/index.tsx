import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useWorkflowBuilderVm } from "../hooks";

export function WorkflowBuilderWebView(): ReactElement {
  const vm = useWorkflowBuilderVm();
  return (
    <FeatureScaffold title="Workflow Builder" summary="可视化工作流构建器" status="Planned">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
