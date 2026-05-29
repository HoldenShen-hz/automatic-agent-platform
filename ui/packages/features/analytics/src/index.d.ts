declare const analyticsFeature: import("@aa/ui-core").FeatureModule;
export default analyticsFeature;
export { createAnalyticsMobileCards } from "./mobile";
export { mapAnalyticsToVm, useAnalyticsVm } from "./hooks";
export { AnalyticsWebView } from "./web";
