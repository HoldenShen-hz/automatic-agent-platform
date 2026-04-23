import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "health",
  title: "Health",
  group: "Operations",
  path: "/operations/health",
  permission: "platform_sre",
  status: "Implemented/Contracted",
  summary: "健康状态与基础指标。",
});
