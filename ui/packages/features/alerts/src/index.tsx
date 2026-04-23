import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "alerts",
  title: "Alerts",
  group: "Mission Control",
  path: "/mission-control/alerts",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "Incident 和高优先级告警流。",
});
