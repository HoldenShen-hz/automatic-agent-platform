import { createFeatureModule } from "@aa/ui-core";
import { MarketplaceWebView } from "./web";

const marketplaceFeature = createFeatureModule({
  id: "marketplace",
  title: "Marketplace",
  group: "Shared",
  path: "/shared/marketplace",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "Marketplace 列表、详情和安装流程。",
  render: MarketplaceWebView,
});

export default marketplaceFeature;
export { createMarketplaceMobileCards } from "./mobile";
export { mapMarketplaceToVm, useMarketplaceVm } from "./hooks";
export { MarketplaceWebView } from "./web";
