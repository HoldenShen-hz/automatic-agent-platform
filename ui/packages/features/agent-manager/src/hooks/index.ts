import { useAgentsQuery } from "@aa/shared-state";
import type { AgentDTO } from "@aa/shared-types";

export interface AgentManagerVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly items: readonly { title: string; description: string }[];
}

export function mapAgentManagerToVm(agents: readonly AgentDTO[]): AgentManagerVm {
  return {
    metrics: [
      { label: "Agents", value: agents.length },
      { label: "Healthy", value: agents.filter((agent) => agent.status === "healthy").length },
      { label: "Degraded", value: agents.filter((agent) => agent.status === "degraded").length },
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
