import { FeatureScaffold, ListCard, MetricGrid, createFeatureModule } from "@aa/ui-core";
import { useIncidentsQuery, useQueuesQuery, useWorkersQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "stability",
  title: "Stability Panel",
  group: "Mission Control",
  path: "/mission-control/stability",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "稳定性、恢复和 backlog 视图。",
  render: () => {
    const incidents = useIncidentsQuery().data ?? [];
    const workers = useWorkersQuery().data ?? [];
    const queues = useQueuesQuery().data ?? [];
    return (
      <FeatureScaffold title="Stability Panel" summary="稳定性、恢复和 backlog 视图" status="Implemented/Internal">
        <MetricGrid
          metrics={[
            { label: "Incidents", value: incidents.length },
            { label: "Workers", value: workers.length },
            { label: "Queues", value: queues.length },
            { label: "DLQ", value: queues.reduce((total, queue) => total + queue.dlq, 0) },
          ]}
        />
        <div style={{ marginTop: 16 }}>
          <ListCard
            items={incidents.map((incident) => ({
              title: `${incident.severity.toUpperCase()} · ${incident.title}`,
              description: incident.summary,
            }))}
          />
        </div>
      </FeatureScaffold>
    );
  },
});
