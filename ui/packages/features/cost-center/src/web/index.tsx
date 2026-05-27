import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useCostCenterVm } from "../hooks";

export function CostCenterWebView(): ReactElement {
  const vm = useCostCenterVm();
  return (
    <FeatureScaffold title="Cost Center" summary="成本中心与预算视图" status="Planned">
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
