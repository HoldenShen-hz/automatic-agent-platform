import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createAgentManagerMobileCards(agents) {
    return agents.slice(0, 3).map((agent) => createMobileFeatureCard(agent.name, `${agent.status} · ${(agent.load * 100).toFixed(0)}%`, agent.domainId));
}
