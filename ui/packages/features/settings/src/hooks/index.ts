import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useDomainConfigsQuery,
  useFeatureFlagsQuery,
  useModelsQuery,
  usePreferencesQuery,
  useRestClient,
  useRolesQuery,
  useTenantsQuery,
  useWebhooksQuery,
} from "@aa/shared-state";
import { updatePreferences } from "@aa/shared-api-client";
import { getSharedTranslationService, translateMessage } from "@aa/shared-i18n";

const translationService = getSharedTranslationService();

export interface SettingsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly leftItems: readonly { title: string; description: string }[];
  readonly centerRows: readonly { key: string; value: string }[];
  readonly rightItems: readonly { title: string; description: string }[];
  readonly loading: boolean;
  readonly draftTheme: "light" | "dark" | "high-contrast";
  readonly draftLocale: string;
  readonly saveState: "idle" | "saving" | "saved" | "error";
  readonly activityItems: readonly { title: string; description: string }[];
  readonly pendingOperations: number;
  readonly localeOptions: readonly { value: string; label: string }[];
  readonly sectionItems: readonly { id: string; title: string; description: string }[];
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activityItems, setActivityItems] = useState<readonly { title: string; description: string }[]>([]);

  useEffect(() => {
    if (preferences != null) {
      setDraftTheme(preferences.theme);
      setDraftLocale(preferences.locale);
    }
  }, [preferences]);

  const centerRows = useMemo(() => preferences == null ? [] : [
    { key: translateMessage("ui.settings.locale.label"), value: draftLocale },
    { key: translateMessage("ui.settings.theme.label"), value: draftTheme },
    { key: translateMessage("ui.settings.center.dashboardPanels"), value: String(preferences.defaultDashboardLayout.length) },
    { key: translateMessage("ui.settings.center.roles"), value: roles.map((role) => `${role.name} (${role.userCount})`).join(", ") },
    { key: translateMessage("ui.settings.center.flags"), value: flags.map((flag) => `${flag.id}:${flag.rolloutPercentage}%`).join(", ") },
  ], [draftLocale, draftTheme, flags, preferences, roles]);

  const save = useCallback(async () => {
    setSaveState("saving");
    const etag = (preferences as { etag?: string }).etag;
    try {
      await updatePreferences(client, { theme: draftTheme, locale: draftLocale }, etag);
      setSaveState("saved");
      setActivityItems((current) => [
        {
          title: translateMessage("ui.settings.activity.saved.title"),
          description: translateMessage("ui.settings.activity.saved.description", { locale: draftLocale, theme: draftTheme }),
        },
        ...current,
      ]);
    } catch (err) {
      setSaveState("error");
      throw err;
    }
  }, [client, draftLocale, draftTheme, preferences]);

  return {
    loading: preferences == null,
    metrics: [
      { label: translateMessage("ui.settings.metric.roles"), value: roles.length },
      { label: translateMessage("ui.settings.metric.featureFlags"), value: flags.length },
      { label: translateMessage("ui.settings.metric.models"), value: models.length },
      { label: translateMessage("ui.settings.metric.tenants"), value: tenants.length },
    ],
    leftItems: [
      { title: translateMessage("ui.settings.preferences.title"), description: translateMessage("ui.settings.preferences.description") },
      { title: translateMessage("ui.settings.permissions.title"), description: translateMessage("ui.settings.permissions.description") },
      { title: translateMessage("ui.settings.flags.title"), description: translateMessage("ui.settings.flags.description") },
      { title: translateMessage("ui.settings.models.title"), description: translateMessage("ui.settings.models.description") },
      { title: translateMessage("ui.settings.domains.title"), description: translateMessage("ui.settings.domains.description") },
      { title: translateMessage("ui.settings.tenants.title"), description: translateMessage("ui.settings.tenants.description") },
      { title: translateMessage("ui.settings.webhooks.title"), description: translateMessage("ui.settings.webhooks.description") },
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
    pendingOperations: saveState === "saving" ? 1 : 0,
    activityItems,
    localeOptions: translationService.listSupportedLocales().map((item) => ({
      value: item.locale,
      label: item.nativeLabel ?? item.locale,
    })),
    sectionItems: [
      {
        id: "general",
        title: translateMessage("ui.settings.section.general"),
        description: translateMessage("ui.settings.section.general.description"),
      },
      {
        id: "api-keys",
        title: translateMessage("ui.settings.section.apiKeys"),
        description: translateMessage("ui.settings.section.apiKeys.description"),
      },
      {
        id: "notifications",
        title: translateMessage("ui.settings.section.notifications"),
        description: translateMessage("ui.settings.section.notifications.description"),
      },
    ],
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
