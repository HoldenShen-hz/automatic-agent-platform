import { createFeatureModule } from "@aa/ui-core";
import { WorkersWebView } from "./web";

const workersFeature = createFeatureModule({
  id: "workers",
  title: "Workers",
  group: "Admin",
  path: "/admin/workers",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "Worker 池容量、分区健康与调度状态。",
  render: WorkersWebView,
});

export default workersFeature;
export { createWorkersMobileCards } from "./mobile";
export { mapWorkersToVm, useWorkersVm } from "./hooks";
export { WorkersWebView } from "./web";
