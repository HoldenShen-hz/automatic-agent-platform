import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { AgentDTO } from "@aa/shared-types";

export function createAgentManagerMobileCards(agents: readonly AgentDTO[]) {
  return agents.slice(0, 3).map((agent) => createMobileFeatureCard(
    agent.name,
    `${agent.status} · ${(agent.load * 100).toFixed(0)}%`,
    agent.domainId,
  ));
}
