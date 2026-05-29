declare const alertsFeature: import("@aa/ui-core").FeatureModule;
export default alertsFeature;
export { createAlertsMobileCards } from "./mobile";
export { mapAlertsToVm, useAlertsVm } from "./hooks";
export { AlertsWebView } from "./web";
