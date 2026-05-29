declare const agentManagerFeature: import("@aa/ui-core").FeatureModule;
export default agentManagerFeature;
export { createAgentManagerMobileCards } from "./mobile";
export { mapAgentManagerToVm, useAgentManagerVm } from "./hooks";
export { AgentManagerWebView } from "./web";
