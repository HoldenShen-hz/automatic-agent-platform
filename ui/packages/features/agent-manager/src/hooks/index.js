import { useAgentsQuery } from "@aa/shared-state";
export function mapAgentManagerToVm(agents) {
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
export function useAgentManagerVm() {
    return mapAgentManagerToVm(useAgentsQuery().data ?? []);
}
