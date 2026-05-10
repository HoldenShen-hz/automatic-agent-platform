import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { QueuesWebView } from "./web";

const featureCopy = translateFeatureCopy("queues");

const queuesFeature = createFeatureModule({
  id: "queues",
  title: featureCopy.title,
  group: "Admin",
  path: "/admin/queues",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: QueuesWebView,
});

export default queuesFeature;
export { createQueuesMobileCards } from "./mobile";
export { mapQueuesToVm, useQueuesVm } from "./hooks";
export { QueuesWebView } from "./web";
