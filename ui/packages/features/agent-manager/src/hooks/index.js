import { useEffect, useMemo, useState } from "react";
import { useAgentsQuery } from "@aa/shared-state";
import { translateMessage } from "@aa/shared-i18n";
function mapAgentToListItem(agent) {
    return {
        id: agent.id,
        title: `${agent.name} · ${agent.status}`,
        subtitle: `${agent.domainId} / load ${(agent.load * 100).toFixed(0)}%`,
    };
}
function buildDetailRows(agent) {
    if (agent == null) {
        return [];
    }
    return [
        { key: "Agent", value: agent.name },
        { key: "Status", value: agent.status },
        { key: "Domain", value: agent.domainId },
        { key: "Load", value: `${(agent.load * 100).toFixed(0)}%` },
        { key: "ID", value: agent.id },
    ];
}
export function useAgentManagerVm() {
    const agentsQuery = useAgentsQuery();
    const agents = agentsQuery.data ?? [];
    const loading = agentsQuery.isLoading;
    const [selectedId, setSelectedId] = useState(null);
    useEffect(() => {
        if (agents.length === 0) {
            setSelectedId(null);
            return;
        }
        setSelectedId((current) => (current != null && agents.some((agent) => agent.id === current)
            ? current
            : agents[0]?.id ?? null));
    }, [agents]);
    const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? null;
    return {
        metrics: [
            { label: translateMessage("ui.agentManager.metric.agents"), value: agents.length },
            { label: translateMessage("ui.agentManager.metric.healthy"), value: agents.filter((agent) => agent.status === "healthy").length },
            { label: translateMessage("ui.agentManager.metric.degraded"), value: agents.filter((agent) => agent.status === "degraded").length },
            { label: "Offline", value: agents.filter((agent) => agent.status === "offline").length },
        ],
        listItems: agents.map(mapAgentToListItem),
        selectedId,
        selectedAgent,
        detailRows: buildDetailRows(selectedAgent),
        summaryItems: useMemo(() => [
            {
                title: "Live supervisor feed",
                description: selectedAgent == null
                    ? "Select an agent to inspect its current runtime status."
                    : `${selectedAgent.name} is currently ${selectedAgent.status} on ${selectedAgent.domainId}.`,
            },
            {
                title: "Mutation policy",
                description: "Isolation and remediation remain blocked until a dedicated agent-control backend contract is added.",
            },
        ], [selectedAgent]),
        loading,
        selectAgent(agentId) {
            setSelectedId(agentId);
        },
    };
}
