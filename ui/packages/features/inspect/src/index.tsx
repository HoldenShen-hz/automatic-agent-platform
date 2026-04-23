import { createFeatureModule } from "@aa/ui-core";
import { InspectWebView } from "./web";

const inspectFeature = createFeatureModule({
  id: "inspect",
  title: "Inspect",
  group: "Operations",
  path: "/operations/inspect",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "Inspect 和 operator snapshot 视图。",
  render: InspectWebView,
});

export default inspectFeature;
export { createInspectMobileCards } from "./mobile";
export { useInspectVm } from "./hooks";
export { InspectWebView } from "./web";
