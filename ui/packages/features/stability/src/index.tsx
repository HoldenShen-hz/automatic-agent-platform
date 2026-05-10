import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { StabilityWebView } from "./web";

const featureCopy = translateFeatureCopy("stability");

const stabilityFeature = createFeatureModule({
  id: "stability",
  title: featureCopy.title,
  group: "Mission Control",
  path: "/mission-control/stability",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: StabilityWebView,
});

export default stabilityFeature;
export { createStabilityMobileCards } from "./mobile";
export { mapStabilityToVm, useStabilityVm } from "./hooks";
export { StabilityWebView } from "./web";
