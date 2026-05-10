import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { IncidentsWebView } from "./web";

const featureCopy = translateFeatureCopy("incidents");

const incidentsFeature = createFeatureModule({
  id: "incidents",
  title: featureCopy.title,
  group: "Operations",
  path: "/operations/incidents",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: featureCopy.summary,
  render: IncidentsWebView,
});

export default incidentsFeature;
export { createIncidentsMobileCards } from "./mobile";
export { mapIncidentsToVm, useIncidentsVm } from "./hooks";
export { IncidentsWebView } from "./web";
