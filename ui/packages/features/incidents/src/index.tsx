import { createFeatureModule } from "@aa/ui-core";
import { IncidentsWebView } from "./web";

const incidentsFeature = createFeatureModule({
  id: "incidents",
  title: "Incidents",
  group: "Operations",
  path: "/operations/incidents",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "Incident 时间线与处置流。",
  render: IncidentsWebView,
});

export default incidentsFeature;
export { createIncidentsMobileCards } from "./mobile";
export { mapIncidentsToVm, useIncidentsVm } from "./hooks";
export { IncidentsWebView } from "./web";
