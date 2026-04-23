import { FeatureScaffold, MetricGrid, createFeatureModule } from "@aa/ui-core";
import { useDashboardSnapshotQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "dashboard",
  title: "Dashboard",
  group: "Mission Control",
  path: "/mission-control/dashboard",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "Mission Control 首页，回答系统是否健康、当前在做什么、卡在哪里。",
  render: () => {
    const query = useDashboardSnapshotQuery();
    const snapshot = query.data;
    return (
      <FeatureScaffold title="Dashboard" summary="Mission Control 首页" status="Implemented/Internal">
        {snapshot == null ? (
          <p>Loading dashboard snapshot...</p>
        ) : (
          <MetricGrid
            metrics={[
              { label: "Overall Health", value: snapshot.overallHealth },
              { label: "Queue Depth", value: snapshot.queueDepth },
              { label: "Active Executions", value: snapshot.activeExecutions },
              { label: "Approval Backlog", value: snapshot.approvalBacklog },
            ]}
          />
        )}
      </FeatureScaffold>
    );
  },
});
