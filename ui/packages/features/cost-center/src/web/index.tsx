import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { useCostCenterVm } from "../hooks";

export function CostCenterWebView(): ReactElement {
  const vm = useCostCenterVm();
  const featureCopy = translateFeatureCopy("cost-center");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "cost-refresh", label: "刷新预算告警", tone: "accent", onTrigger: buildWorkbenchActionHandler("cost-center", "refresh", { deepLinkPath: "/operations/cost-center?mode=refresh" }) },
          { id: "cost-drill", label: "下钻成本项", tone: "neutral", onTrigger: buildWorkbenchActionHandler("cost-center", "drill", { deepLinkPath: "/operations/cost-center?view=drilldown" }) },
          { id: "cost-export", label: "导出成本报表", tone: "neutral", onTrigger: buildWorkbenchActionHandler("cost-center", "export", { copySelection: true }) },
        ]}
      />
    </FeatureScaffold>
  );
}
