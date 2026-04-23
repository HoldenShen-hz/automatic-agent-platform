import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "stability",
  title: "Stability Panel",
  group: "Mission Control",
  path: "/mission-control/stability",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "稳定性、恢复和 backlog 视图。",
});
