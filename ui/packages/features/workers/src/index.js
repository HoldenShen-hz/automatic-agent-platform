import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { WorkersWebView } from "./web";
const featureCopy = translateFeatureCopy("workers");
const workersFeature = createFeatureModule({
    id: "workers",
    title: featureCopy.title,
    group: "Admin",
    path: "/admin/workers",
    permission: "platform_sre",
    status: "Implemented/Internal",
    summary: featureCopy.summary,
    render: WorkersWebView,
});
export default workersFeature;
export { createWorkersMobileCards } from "./mobile";
export { mapWorkersToVm, useWorkersVm } from "./hooks";
export { WorkersWebView } from "./web";
