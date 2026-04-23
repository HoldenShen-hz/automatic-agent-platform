import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "takeover",
  title: "Admin Takeover Console",
  group: "Admin",
  path: "/admin/takeover",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "管理员接管、重试和人工覆盖入口。",
});
