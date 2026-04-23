import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "cost-center",
  title: "Cost Center",
  group: "Shared",
  path: "/shared/costs",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "成本中心与预算视图。",
});
