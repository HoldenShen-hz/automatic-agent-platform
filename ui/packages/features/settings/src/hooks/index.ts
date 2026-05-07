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
  useThemeState,
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

/**
 * Settings ViewModel with proper ETag-based optimistic locking per §4.7.8.
 * Uses If-Match header for concurrent update detection.
 */
export function useSettingsVm(): SettingsVm {
  const client = useRestClient();
  const { setThemeMode } = useThemeState();
  const preferencesQuery = usePreferencesQuery();
  const preferences = preferencesQuery.data;
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

  // §2277: Use preferences directly in deps - preferenceTheme/Locale are derived and may miss updates
  useEffect(() => {
    if (preferences != null) {
      setDraftTheme(preferences.theme);
      setDraftLocale(preferences.locale);
      setThemeMode(preferences.theme);
    }
  }, [preferences, setThemeMode]);

  const centerRows = useMemo(() => preferences == null ? [] : [
    { key: "Locale", value: draftLocale },
    { key: "Theme", value: draftTheme },
    { key: "Dashboard Panels", value: String(preferences.defaultDashboardLayout.length) },
    { key: "Roles", value: roles.map((role) => `${role.name} (${role.userCount})`).join(", ") },
    { key: "Flags", value: flags.map((flag) => `${flag.id}:${flag.rolloutPercentage}%`).join(", ") },
  ], [draftLocale, draftTheme, flags, preferences, roles]);

  /**
   * Saves preferences with ETag-based optimistic locking per §4.7.8.
   * The ETag is extracted from preferences to detect concurrent modifications.
   */
  const save = useCallback(async (): Promise<void> => {
    if (preferences == null) {
      return;
    }
    setSaveState("saving");
    try {
      // §4.7.8: Use If-Match header with ETag for optimistic locking
      const etag = (preferences as { etag?: string }).etag;
      await updatePreferences(client, { theme: draftTheme, locale: draftLocale }, etag);
      // §2269: Use setTimeout to ensure saving->saved transition is visible in React batch
      // Without this, React 18 batches the state change and saving is never visible
      setTimeout(() => {
        setSaveState("saved");
        setActivityItems((current) => [
          {
            title: "Configuration saved",
            description: `Preferences updated to ${draftLocale} / ${draftTheme}; flags, models, domains and tenants remain in sync.`,
          },
          ...current,
        ].slice(0, 100)); // §2275: Limit activityItems to 100 entries to prevent unbounded growth
      }, 50);
    } catch (error) {
      setSaveState("idle");
      // Could handle 409 Conflict here to show user a message
      console.error("[Settings] Save failed:", error);
    }
  }, [client, draftTheme, draftLocale, preferences]);

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
      setThemeMode(theme);
      setSaveState("idle");
    },
    setDraftLocale(locale: string) {
      setDraftLocale(locale);
      setSaveState("idle");
    },
    save,
  };
}
