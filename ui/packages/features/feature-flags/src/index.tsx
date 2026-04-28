import { createFeatureModule } from "@aa/ui-core";
import { FeatureFlagsWebView } from "./web";

const featureFlagsFeature = createFeatureModule({
  id: "feature-flags",
  title: "Feature Flags",
  group: "Admin",
  path: "/admin/feature-flags",
  permission: "admin+",
  status: "Implemented/Internal",
  summary: "Feature flag management for progressive rollout and A/B testing.",
  render: FeatureFlagsWebView,
});

export default featureFlagsFeature;
export { FeatureFlagsWebView } from "./web";
export { useFeatureFlagsVm } from "./hooks";