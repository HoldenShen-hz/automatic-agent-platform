import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, ThreePaneLayout, createFeatureModule } from "@aa/ui-core";
import {
  useDomainConfigsQuery,
  useFeatureFlagsQuery,
  useModelsQuery,
  usePreferencesQuery,
  useRolesQuery,
  useTenantsQuery,
  useWebhooksQuery,
} from "@aa/shared-state";

export default createFeatureModule({
  id: "settings",
  title: "Settings",
  group: "Shared",
  path: "/shared/settings",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "配置中心、用户偏好、域设置与模型配置入口。",
  render: () => {
    const preferences = usePreferencesQuery().data;
    const roles = useRolesQuery().data ?? [];
    const flags = useFeatureFlagsQuery().data ?? [];
    const models = useModelsQuery().data ?? [];
    const domains = useDomainConfigsQuery().data ?? [];
    const tenants = useTenantsQuery().data ?? [];
    const webhooks = useWebhooksQuery().data ?? [];

    return (
      <FeatureScaffold title="Settings" summary="偏好、权限、功能开关、模型、域、租户与 Webhook 管理中心" status="Implemented/Partial">
        <MetricGrid
          metrics={[
            { label: "Roles", value: roles.length },
            { label: "Feature Flags", value: flags.length },
            { label: "Models", value: models.length },
            { label: "Tenants", value: tenants.length },
          ]}
        />
        <div style={{ marginTop: 16 }}>
          <ThreePaneLayout
            left={(
              <ListCard
                items={[
                  { title: "User Preferences", description: "locale / theme / dashboard layout" },
                  { title: "Permission Manager", description: "roles, scopes, assignments" },
                  { title: "Feature Flags", description: "rollout, targeting, enablement" },
                  { title: "Model Config", description: "provider, domain binding, budget" },
                  { title: "Domain Settings", description: "drill depth, visibility, owner" },
                  { title: "Tenant Manager", description: "tenant lifecycle and domain mapping" },
                  { title: "Webhook Manager", description: "event sinks and delivery hooks" },
                ]}
              />
            )}
            center={preferences == null ? <p>Loading settings...</p> : (
              <KeyValueTable
                rows={[
                  { key: "Locale", value: preferences.locale },
                  { key: "Theme", value: preferences.theme },
                  { key: "Dashboard Panels", value: String(preferences.defaultDashboardLayout.length) },
                  { key: "Roles", value: roles.map((role) => `${role.name} (${role.userCount})`).join(", ") },
                  { key: "Flags", value: flags.map((flag) => `${flag.id}:${flag.rolloutPercentage}%`).join(", ") },
                ]}
              />
            )}
            right={(
              <ListCard
                items={[
                  ...models.map((model) => ({
                    title: `${model.provider}/${model.model}`,
                    description: `${model.boundDomains.join(", ")} · budget $${model.budgetUsd}`,
                  })),
                  ...domains.map((domain) => ({
                    title: `${domain.displayName}`,
                    description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
                  })),
                  ...tenants.map((tenant) => ({
                    title: `${tenant.name} · ${tenant.status}`,
                    description: tenant.domains.join(", "),
                  })),
                  ...webhooks.map((webhook) => ({
                    title: `${webhook.targetUrl}`,
                    description: `${webhook.eventCount} events · ${webhook.enabled ? "enabled" : "disabled"}`,
                  })),
                ]}
              />
            )}
          />
        </div>
      </FeatureScaffold>
    );
  },
});
