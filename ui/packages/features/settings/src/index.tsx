import { FeatureScaffold, MetricGrid, createFeatureModule } from "@aa/ui-core";
import { usePreferencesQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "settings",
  title: "Settings",
  group: "Shared",
  path: "/shared/settings",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "配置中心、用户偏好、域设置与模型配置入口。",
  render: () => {
    const query = usePreferencesQuery();
    const preferences = query.data;
    return (
      <FeatureScaffold title="Settings" summary="偏好与配置中心" status="Implemented/Partial">
        {preferences == null ? (
          <p>Loading preferences...</p>
        ) : (
          <MetricGrid
            metrics={[
              { label: "Locale", value: preferences.locale },
              { label: "Theme", value: preferences.theme },
              { label: "Dashboard Panels", value: preferences.defaultDashboardLayout.length },
            ]}
          />
        )}
      </FeatureScaffold>
    );
  },
});
