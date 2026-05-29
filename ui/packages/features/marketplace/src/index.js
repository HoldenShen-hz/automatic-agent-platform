import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { MarketplaceWebView } from "./web";
const featureCopy = translateFeatureCopy("marketplace");
const marketplaceFeature = createFeatureModule({
    id: "marketplace",
    title: featureCopy.title,
    group: "Shared",
    path: "/shared/marketplace",
    permission: "authenticated",
    status: "Planned",
    summary: featureCopy.summary,
    render: MarketplaceWebView,
});
export default marketplaceFeature;
export { createMarketplaceMobileCards } from "./mobile";
export { mapMarketplaceToVm, useMarketplaceVm } from "./hooks";
export { MarketplaceWebView } from "./web";
