import { FeatureScaffold, MetricGrid, createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "workers",
  title: "Workers",
  group: "Admin",
  path: "/admin/workers",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "Worker 池容量、分区健康与调度状态。",
  render: () => (
    <FeatureScaffold title="Workers" summary="执行 Worker 运行面板" status="Implemented/Internal">
      <MetricGrid
        metrics={[
          { label: "Active Workers", value: 12 },
          { label: "Busy", value: 7 },
          { label: "Draining", value: 1 },
          { label: "Heartbeat Lag", value: "240ms" },
        ]}
      />
    </FeatureScaffold>
  ),
});
