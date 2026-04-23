import { createFeatureModule } from "@aa/ui-core";
import { StabilityWebView } from "./web";

const stabilityFeature = createFeatureModule({
  id: "stability",
  title: "Stability Panel",
  group: "Mission Control",
  path: "/mission-control/stability",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "稳定性、恢复和 backlog 视图。",
  render: StabilityWebView,
});

export default stabilityFeature;
export { createStabilityMobileCards } from "./mobile";
export { mapStabilityToVm, useStabilityVm } from "./hooks";
export { StabilityWebView } from "./web";
