import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useDispatchVm } from "../hooks";

export function DispatchWebView(): ReactElement {
  const vm = useDispatchVm();
  return (
    <FeatureScaffold title="Dispatch" summary="调度、执行和操作入口。" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "dispatch-now", label: "立即派发", tone: "accent", onTrigger: buildWorkbenchActionHandler("dispatch", "dispatch-now", { deepLinkPath: "/operations/dispatch?mode=dispatch-now" }) },
          { id: "dispatch-priority", label: "重排优先级", tone: "neutral", onTrigger: buildWorkbenchActionHandler("dispatch", "priority", { deepLinkPath: "/operations/dispatch?view=priority" }) },
          { id: "dispatch-approval", label: "转人工审批", tone: "danger", onTrigger: buildWorkbenchActionHandler("dispatch", "approval", { deepLinkPath: "/operations/dispatch?mode=approval" }) },
        ]}
      />
    </FeatureScaffold>
  );
}
