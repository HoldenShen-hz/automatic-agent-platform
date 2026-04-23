import { FeatureScaffold, ListCard, MetricGrid, createFeatureModule } from "@aa/ui-core";
import { useAgentsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "agent-manager",
  title: "Agent Manager",
  group: "Extended",
  path: "/extended/agents",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "Agent 实时监控中心与详情页。",
  render: () => {
    const agents = useAgentsQuery().data ?? [];
    return (
      <FeatureScaffold title="Agent Manager" summary="Agent 实时监控中心与详情页" status="Planned">
        <MetricGrid
          metrics={[
            { label: "Agents", value: agents.length },
            { label: "Healthy", value: agents.filter((agent) => agent.status === "healthy").length },
            { label: "Degraded", value: agents.filter((agent) => agent.status === "degraded").length },
          ]}
        />
        <div style={{ marginTop: 16 }}>
          <ListCard
            items={agents.map((agent) => ({
              title: `${agent.name} · ${agent.status}`,
              description: `${agent.domainId} / load ${(agent.load * 100).toFixed(0)}%`,
            }))}
          />
        </div>
      </FeatureScaffold>
    );
  },
});
