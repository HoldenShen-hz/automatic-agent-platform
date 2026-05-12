import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { AlertsWebView } from "./web";

const featureCopy = translateFeatureCopy("alerts");

const alertsFeature = createFeatureModule({
  id: "alerts",
  title: featureCopy.title,
  group: "Mission Control",
  path: "/mission-control/alerts",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: AlertsWebView,
});

export default alertsFeature;
export { createAlertsMobileCards } from "./mobile";
export { mapAlertsToVm, useAlertsVm } from "./hooks";
export { AlertsWebView } from "./web";
