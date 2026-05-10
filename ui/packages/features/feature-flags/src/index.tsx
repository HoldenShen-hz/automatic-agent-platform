import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { FeatureFlagsWebView } from "./web";

const featureCopy = translateFeatureCopy("feature-flags");

const featureFlagsFeature = createFeatureModule({
  id: "feature-flags",
  title: featureCopy.title,
  group: "Admin",
  path: "/admin/feature-flags",
  permission: "admin+",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: FeatureFlagsWebView,
});

export default featureFlagsFeature;
export { createFeatureFlagsMobileCards } from "./mobile";
export { FeatureFlagsWebView } from "./web";
export { useFeatureFlagsVm } from "./hooks";
