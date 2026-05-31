import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useDispatchVm } from "../hooks";

export function DispatchWebView(): ReactElement {
  const vm = useDispatchVm();
  const featureCopy = translateFeatureCopy("dispatch");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
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
