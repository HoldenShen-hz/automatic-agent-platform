import {
  useDomainConfigsQuery,
  useFeatureFlagsQuery,
  useModelsQuery,
  usePreferencesQuery,
  useRolesQuery,
  useTenantsQuery,
  useWebhooksQuery,
} from "@aa/shared-state";

export interface SettingsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly leftItems: readonly { title: string; description: string }[];
  readonly centerRows: readonly { key: string; value: string }[];
  readonly rightItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
}

export function useSettingsVm(): SettingsVm {
  const preferences = usePreferencesQuery().data;
  const roles = useRolesQuery().data ?? [];
  const flags = useFeatureFlagsQuery().data ?? [];
  const models = useModelsQuery().data ?? [];
  const domains = useDomainConfigsQuery().data ?? [];
  const tenants = useTenantsQuery().data ?? [];
  const webhooks = useWebhooksQuery().data ?? [];

  return {
    loading: preferences == null,
    metrics: [
      { label: "Roles", value: roles.length },
      { label: "Feature Flags", value: flags.length },
      { label: "Models", value: models.length },
      { label: "Tenants", value: tenants.length },
    ],
    leftItems: [
      { title: "User Preferences", description: "locale / theme / dashboard layout" },
      { title: "Permission Manager", description: "roles, scopes, assignments" },
      { title: "Feature Flags", description: "rollout, targeting, enablement" },
      { title: "Model Config", description: "provider, domain binding, budget" },
      { title: "Domain Settings", description: "drill depth, visibility, owner" },
      { title: "Tenant Manager", description: "tenant lifecycle and domain mapping" },
      { title: "Webhook Manager", description: "event sinks and delivery hooks" },
    ],
    centerRows: preferences == null ? [] : [
      { key: "Locale", value: preferences.locale },
      { key: "Theme", value: preferences.theme },
      { key: "Dashboard Panels", value: String(preferences.defaultDashboardLayout.length) },
      { key: "Roles", value: roles.map((role) => `${role.name} (${role.userCount})`).join(", ") },
      { key: "Flags", value: flags.map((flag) => `${flag.id}:${flag.rolloutPercentage}%`).join(", ") },
    ],
    rightItems: [
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
    ],
  };
}
