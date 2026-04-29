import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useDomainConfigsQuery,
  useFeatureFlagsQuery,
  useModelsQuery,
  usePreferencesQuery,
  useRolesQuery,
  useTenantsQuery,
  useWebhooksQuery,
  useRestClient,
} from "@aa/shared-state";
import { updatePreferences } from "@aa/shared-api-client";

export interface SettingsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly leftItems: readonly { title: string; description: string }[];
  readonly centerRows: readonly { key: string; value: string }[];
  readonly rightItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly draftTheme: "light" | "dark" | "high-contrast";
  readonly draftLocale: string;
  readonly saveState: "idle" | "saving" | "saved";
  readonly activityItems: readonly { title: string; description: string }[];
  setDraftTheme(theme: "light" | "dark" | "high-contrast"): void;
  setDraftLocale(locale: string): void;
  save(): Promise<void>;
}

export function useSettingsVm(): SettingsVm {
  const client = useRestClient();
  const preferences = usePreferencesQuery().data;
  const roles = useRolesQuery().data ?? [];
  const flags = useFeatureFlagsQuery().data ?? [];
  const models = useModelsQuery().data ?? [];
  const domains = useDomainConfigsQuery().data ?? [];
  const tenants = useTenantsQuery().data ?? [];
  const webhooks = useWebhooksQuery().data ?? [];
  const [draftTheme, setDraftTheme] = useState<"light" | "dark" | "high-contrast">("dark");
  const [draftLocale, setDraftLocale] = useState("zh-CN");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [activityItems, setActivityItems] = useState<readonly { title: string; description: string }[]>([]);
  const preferenceTheme = preferences?.theme;
  const preferenceLocale = preferences?.locale;

  useEffect(() => {
    if (preferences != null) {
      setDraftTheme(preferences.theme);
      setDraftLocale(preferences.locale);
    }
  }, [preferenceLocale, preferenceTheme]);

  const centerRows = useMemo(() => preferences == null ? [] : [
    { key: "Locale", value: draftLocale },
    { key: "Theme", value: draftTheme },
    { key: "Dashboard Panels", value: String(preferences.defaultDashboardLayout.length) },
    { key: "Roles", value: roles.map((role) => `${role.name} (${role.userCount})`).join(", ") },
    { key: "Flags", value: flags.map((flag) => `${flag.id}:${flag.rolloutPercentage}%`).join(", ") },
  ], [draftLocale, draftTheme, flags, preferences, roles]);

  const save = useCallback(async (): Promise<void> => {
    setSaveState("saving");
    try {
      await updatePreferences(client, { theme: draftTheme, locale: draftLocale });
      setSaveState("saved");
      setActivityItems((current) => [
        {
          title: "Configuration saved",
          description: `Preferences updated to ${draftLocale} / ${draftTheme}; flags, models, domains and tenants remain in sync.`,
        },
        ...current,
      ]);
    } catch {
      setSaveState("idle");
    }
  }, [client, draftTheme, draftLocale]);

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
    centerRows,
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
    draftTheme,
    draftLocale,
    saveState,
    activityItems,
    setDraftTheme(theme: "light" | "dark" | "high-contrast") {
      setDraftTheme(theme);
      setSaveState("idle");
    },
    setDraftLocale(locale: string) {
      setDraftLocale(locale);
      setSaveState("idle");
    },
    save,
  };
}
