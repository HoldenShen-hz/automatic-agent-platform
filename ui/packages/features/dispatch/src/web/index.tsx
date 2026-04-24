import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useDispatchVm } from "../hooks";

export function DispatchWebView(): ReactElement {
  const vm = useDispatchVm();
  return (
    <FeatureScaffold title="Dispatch" summary="调度、执行和操作入口。" status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "dispatch-now", label: "立即派发", tone: "accent" },
          { id: "dispatch-priority", label: "重排优先级", tone: "neutral" },
          { id: "dispatch-approval", label: "转人工审批", tone: "danger" },
        ]}
      />
    </FeatureScaffold>
  );
}
