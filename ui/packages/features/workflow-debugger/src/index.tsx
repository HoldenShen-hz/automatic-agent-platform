import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "workflow-debugger",
  title: "Workflow Debugger",
  group: "Extended",
  path: "/extended/debugger",
  permission: "pack_developer+",
  status: "Planned",
  kind: "planned",
  summary: "调试器、时间线和数据流回放。",
});
