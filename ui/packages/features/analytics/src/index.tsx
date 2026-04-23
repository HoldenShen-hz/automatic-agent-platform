import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "analytics",
  title: "Analytics",
  group: "Shared",
  path: "/shared/analytics",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "多层级 KPI 看板与图表渲染架构。",
});
