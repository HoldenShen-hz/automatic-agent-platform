import type { ReactElement } from "react";
import { FeatureScaffold, ListCard } from "@aa/ui-core";
import { useMarketplaceVm } from "../hooks";

export function MarketplaceWebView(): ReactElement {
  const vm = useMarketplaceVm();
  return (
    <FeatureScaffold title="Marketplace" summary="Marketplace 列表、详情和安装流程" status="Planned">
      <ListCard items={vm.items} />
    </FeatureScaffold>
  );
}
