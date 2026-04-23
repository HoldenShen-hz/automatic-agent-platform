import { FeatureScaffold, MetricGrid, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "queues",
  title: "Queues",
  group: "Admin",
  path: "/admin/queues",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "队列深度、重试、DLQ 与分区负载。",
  render: () => (
    <FeatureScaffold title="Queues" summary="队列与 DLQ 监控面板" status="Implemented/Internal">
      <MetricGrid
        metrics={[
          { label: "Ready", value: 84 },
          { label: "In Flight", value: 19 },
          { label: "Retries", value: 3 },
          { label: "DLQ", value: 1 },
        ]}
      />
    </FeatureScaffold>
  ),
});
