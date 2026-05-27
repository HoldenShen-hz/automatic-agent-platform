import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { DispatchWebView } from "./web";

const featureCopy = translateFeatureCopy("dispatch");

const dispatchFeature = createFeatureModule({
  id: "dispatch",
  title: featureCopy.title,
  group: "Operations",
  path: "/operations/dispatch",
  permission: "platform_sre",
  status: "Planned",
  summary: featureCopy.summary,
  render: DispatchWebView,
});

export default dispatchFeature;
export { createDispatchMobileCards } from "./mobile";
export { useDispatchVm } from "./hooks";
export { DispatchWebView } from "./web";
