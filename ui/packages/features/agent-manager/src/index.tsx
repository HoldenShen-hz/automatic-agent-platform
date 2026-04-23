import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "agent-manager",
  title: "Agent Manager",
  group: "Extended",
  path: "/extended/agents",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "Agent 实时监控中心与详情页。",
});
