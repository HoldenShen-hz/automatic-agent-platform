import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { AnalyticsWebView } from "./web";

const featureCopy = translateFeatureCopy("analytics");

const analyticsFeature = createFeatureModule({
  id: "analytics",
  title: featureCopy.title,
  group: "Shared",
  path: "/shared/analytics",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: featureCopy.summary,
  render: AnalyticsWebView,
});

export default analyticsFeature;
export { createAnalyticsMobileCards } from "./mobile";
export { mapAnalyticsToVm, useAnalyticsVm } from "./hooks";
export { AnalyticsWebView } from "./web";
