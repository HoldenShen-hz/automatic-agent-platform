import { createFeatureModule } from "@aa/ui-core";
import { QueuesWebView } from "./web";

const queuesFeature = createFeatureModule({
  id: "queues",
  title: "Queues",
  group: "Admin",
  path: "/admin/queues",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "队列深度、重试、DLQ 与分区负载。",
  render: QueuesWebView,
});

export default queuesFeature;
export { createQueuesMobileCards } from "./mobile";
export { mapQueuesToVm, useQueuesVm } from "./hooks";
export { QueuesWebView } from "./web";
