import { createFeatureModule } from "@aa/ui-core";
import { HealthWebView } from "./web";

const healthFeature = createFeatureModule({
  id: "health",
  title: "Health",
  group: "Operations",
  path: "/operations/health",
  permission: "platform_sre",
  status: "Implemented/Contracted",
  summary: "健康状态与基础指标。",
  render: HealthWebView,
});

export default healthFeature;
export { createHealthMobileCards } from "./mobile";
export { useHealthVm } from "./hooks";
export { HealthWebView } from "./web";
