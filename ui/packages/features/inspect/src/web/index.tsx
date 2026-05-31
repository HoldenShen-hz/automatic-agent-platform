import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useInspectVm } from "../hooks";

export function InspectWebView(): ReactElement {
  const vm = useInspectVm();
  const featureCopy = translateFeatureCopy("inspect");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "inspect-snapshot", label: "抓取快照", tone: "accent", onTrigger: buildWorkbenchActionHandler("inspect", "snapshot", { deepLinkPath: "/operations/inspect?mode=snapshot" }) },
          { id: "inspect-compare", label: "对比上次执行", tone: "neutral", onTrigger: buildWorkbenchActionHandler("inspect", "compare", { deepLinkPath: "/operations/inspect?view=compare" }) },
          { id: "inspect-export", label: "导出证据链", tone: "neutral", onTrigger: buildWorkbenchActionHandler("inspect", "export", { copySelection: true }) },
        ]}
      />
    </FeatureScaffold>
  );
}
