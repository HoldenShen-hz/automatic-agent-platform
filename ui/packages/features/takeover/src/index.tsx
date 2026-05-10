import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { TakeoverWebView } from "./web";

const featureCopy = translateFeatureCopy("takeover");

const takeoverFeature = createFeatureModule({
  id: "takeover",
  title: featureCopy.title,
  group: "Admin",
  path: "/admin/takeover",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: TakeoverWebView,
});

export default takeoverFeature;
export { createTakeoverMobileCards } from "./mobile";
export { useTakeoverVm } from "./hooks";
export { TakeoverWebView } from "./web";
