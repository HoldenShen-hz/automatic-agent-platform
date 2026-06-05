import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { AgentManagerWebView } from "./web";
const featureCopy = translateFeatureCopy("agent-manager");
const agentManagerFeature = createFeatureModule({
    id: "agent-manager",
    title: featureCopy.title,
    group: "Extended",
    path: "/extended/agents",
    permission: "domain_admin+",
    status: "Implemented/Partial",
    summary: featureCopy.summary,
    render: AgentManagerWebView,
});
export default agentManagerFeature;
export { createAgentManagerMobileCards } from "./mobile";
export { useAgentManagerVm } from "./hooks";
export { AgentManagerWebView } from "./web";
