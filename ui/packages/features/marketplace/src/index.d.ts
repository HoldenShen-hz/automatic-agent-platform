declare const marketplaceFeature: import("@aa/ui-core").FeatureModule;
export default marketplaceFeature;
export { createMarketplaceMobileCards } from "./mobile";
export { mapMarketplaceToVm, useMarketplaceVm } from "./hooks";
export { MarketplaceWebView } from "./web";
