import { createFeatureModule } from "@aa/ui-core";
import { DashboardWebView } from "./web";

const dashboardFeature = createFeatureModule({
  id: "dashboard",
  title: "Dashboard",
  group: "Mission Control",
  path: "/mission-control/dashboard",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "Mission Control 首页，回答系统是否健康、当前在做什么、卡在哪里。",
  render: DashboardWebView,
});

export default dashboardFeature;
export { createDashboardMobileCards } from "./mobile";
export { mapDashboardSnapshotToVm, useDashboardVm } from "./hooks";
export { DashboardWebView } from "./web";
