import { createFeatureModule } from "@aa/ui-core";
import { AgentManagerWebView } from "./web";

const agentManagerFeature = createFeatureModule({
  id: "agent-manager",
  title: "Agent Manager",
  group: "Extended",
  path: "/extended/agents",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "Agent 实时监控中心与详情页。",
  render: AgentManagerWebView,
});

export default agentManagerFeature;
export { createAgentManagerMobileCards } from "./mobile";
export { mapAgentManagerToVm, useAgentManagerVm } from "./hooks";
export { AgentManagerWebView } from "./web";
