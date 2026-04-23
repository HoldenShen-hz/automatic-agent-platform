import { createFeatureModule } from "@aa/ui-core";
import { AlertsWebView } from "./web";

const alertsFeature = createFeatureModule({
  id: "alerts",
  title: "Alerts",
  group: "Mission Control",
  path: "/mission-control/alerts",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "Incident 和高优先级告警流。",
  render: AlertsWebView,
});

export default alertsFeature;
export { createAlertsMobileCards } from "./mobile";
export { mapAlertsToVm, useAlertsVm } from "./hooks";
export { AlertsWebView } from "./web";
