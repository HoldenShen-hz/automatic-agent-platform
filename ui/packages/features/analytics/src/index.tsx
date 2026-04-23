import { createFeatureModule } from "@aa/ui-core";
import { AnalyticsWebView } from "./web";

const analyticsFeature = createFeatureModule({
  id: "analytics",
  title: "Analytics",
  group: "Shared",
  path: "/shared/analytics",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "多层级 KPI 看板与图表渲染架构。",
  render: AnalyticsWebView,
});

export default analyticsFeature;
export { createAnalyticsMobileCards } from "./mobile";
export { mapAnalyticsToVm, useAnalyticsVm } from "./hooks";
export { AnalyticsWebView } from "./web";
