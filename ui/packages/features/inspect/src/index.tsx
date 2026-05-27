import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { InspectWebView } from "./web";

const featureCopy = translateFeatureCopy("inspect");

const inspectFeature = createFeatureModule({
  id: "inspect",
  title: featureCopy.title,
  group: "Operations",
  path: "/operations/inspect",
  permission: "platform_sre",
  status: "Planned",
  summary: featureCopy.summary,
  render: InspectWebView,
});

export default inspectFeature;
export { createInspectMobileCards } from "./mobile";
export { useInspectVm } from "./hooks";
export { InspectWebView } from "./web";
