import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "workflow-cockpit",
  title: "Workflow Cockpit",
  group: "Mission Control",
  path: "/mission-control/workflows",
  permission: "pack_developer+",
  status: "Implemented/Internal",
  summary: "工作流 DAG、步骤和恢复基线视图。",
});
