import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { DashboardWebView } from "./web";

const featureCopy = translateFeatureCopy("dashboard");

const dashboardFeature = createFeatureModule({
  id: "dashboard",
  title: featureCopy.title,
  group: "Mission Control",
  path: "/mission-control/dashboard",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: DashboardWebView,
});

export default dashboardFeature;
export { createDashboardMobileCards } from "./mobile";
export { mapDashboardSnapshotToVm, useDashboardVm } from "./hooks";
export { DashboardWebView } from "./web";
