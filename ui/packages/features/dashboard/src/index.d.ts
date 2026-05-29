declare const dashboardFeature: import("@aa/ui-core").FeatureModule;
export default dashboardFeature;
export { createDashboardMobileCards } from "./mobile";
export { mapDashboardSnapshotToVm, useDashboardVm } from "./hooks";
export { DashboardWebView } from "./web";
