import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "workflow-builder",
  title: "Workflow Builder",
  group: "Extended",
  path: "/extended/workflow-builder",
  permission: "pack_developer+",
  status: "Planned",
  kind: "planned",
  summary: "可视化工作流构建器，先通过 contract seam 与 feature gate 落位。",
});
