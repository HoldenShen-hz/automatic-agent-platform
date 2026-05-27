import type { ReactElement } from "react";
import { buildWorkbenchActionHandler, FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useMarketplaceVm } from "../hooks";

export function MarketplaceWebView(): ReactElement {
  const vm = useMarketplaceVm();
  return (
    <FeatureScaffold title="Marketplace" summary="Marketplace 列表、详情和安装流程" status="Planned">
      <FeatureWorkbenchPanel
        items={vm.items}
        actions={[
          { id: "marketplace-preview", label: "预览安装影响", tone: "accent", onTrigger: buildWorkbenchActionHandler("marketplace", "preview", { deepLinkPath: "/extended/marketplace?mode=preview" }) },
          { id: "marketplace-shortlist", label: "加入候选清单", tone: "neutral", onTrigger: buildWorkbenchActionHandler("marketplace", "shortlist", { copySelection: true }) },
          { id: "marketplace-approval", label: "发起安装审批", tone: "danger", onTrigger: buildWorkbenchActionHandler("marketplace", "approval", { deepLinkPath: "/extended/marketplace?mode=approval" }) },
        ]}
      />
    </FeatureScaffold>
  );
}
