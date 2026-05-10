import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { HealthWebView } from "./web";

const featureCopy = translateFeatureCopy("health");

const healthFeature = createFeatureModule({
  id: "health",
  title: featureCopy.title,
  group: "Operations",
  path: "/operations/health",
  permission: "platform_sre",
  status: "Implemented/Contracted",
  summary: featureCopy.summary,
  render: HealthWebView,
});

export default healthFeature;
export { createHealthMobileCards } from "./mobile";
export { useHealthVm } from "./hooks";
export { HealthWebView } from "./web";
