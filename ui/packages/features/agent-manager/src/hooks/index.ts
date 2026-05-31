import { useAgentsQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
import type { AgentDTO } from "@aa/shared-types";

export interface AgentManagerVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly items: readonly { title: string; description: string }[];
}

export function mapAgentManagerToVm(agents: readonly AgentDTO[]): AgentManagerVm {
  return {
    metrics: [
      { label: translateMessage("ui.agentManager.metric.agents"), value: agents.length },
      { label: translateMessage("ui.agentManager.metric.healthy"), value: agents.filter((agent) => agent.status === "healthy").length },
      { label: translateMessage("ui.agentManager.metric.degraded"), value: agents.filter((agent) => agent.status === "degraded").length },
    ],
    items: agents.map((agent) => ({
      title: `${agent.name} · ${agent.status}`,
      description: `${agent.domainId} / load ${(agent.load * 100).toFixed(0)}%`,
    })),
  };
}

export function useAgentManagerVm(): AgentManagerVm {
  return mapAgentManagerToVm(useAgentsQuery().data ?? []);
}
