import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "marketplace",
  title: "Marketplace",
  group: "Shared",
  path: "/shared/marketplace",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "Marketplace 列表、详情和安装流程。",
});
