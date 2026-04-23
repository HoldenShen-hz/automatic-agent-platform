import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "inspect",
  title: "Inspect",
  group: "Operations",
  path: "/operations/inspect",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "Inspect 和 operator snapshot 视图。",
});
