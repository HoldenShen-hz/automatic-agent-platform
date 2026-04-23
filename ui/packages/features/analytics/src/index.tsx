import { FeatureScaffold, MetricGrid, createFeatureModule } from "@aa/ui-core";
import { useAnalyticsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "analytics",
  title: "Analytics",
  group: "Shared",
  path: "/shared/analytics",
  permission: "authenticated",
  status: "Planned",
  kind: "planned",
  summary: "多层级 KPI 看板与图表渲染架构。",
  render: () => {
    const metrics = useAnalyticsQuery().data ?? [];
    return (
      <FeatureScaffold title="Analytics" summary="多层级 KPI 看板与图表渲染架构" status="Planned">
        <MetricGrid metrics={metrics.map((metric) => ({ label: metric.label, value: metric.value }))} />
      </FeatureScaffold>
    );
  },
});
