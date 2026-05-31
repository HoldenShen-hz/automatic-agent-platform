import { useMemo } from "react";
import { translateMessage } from "@aa/shared-i18n";
import { useFeatureFlagsQuery } from "@aa/shared-state";
import type { FeatureFlagDTO } from "@aa/shared-types";

export interface FeatureFlagsVm {
  readonly isLoading: boolean;
  readonly flags: readonly FeatureFlagDTO[];
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly items: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly detailRows: readonly { key: string; value: string }[];
  }[];
}

export function useFeatureFlagsVm(): FeatureFlagsVm {
  const query = useFeatureFlagsQuery();
  const flags = query.data ?? [];
  const enabledCount = flags.filter((flag) => flag.enabled).length;

  const items = useMemo(() => flags.map((flag) => ({
    id: flag.id,
    title: flag.id,
    description: translateMessage("ui.featureFlags.item.description", {
      status: translateMessage(flag.enabled ? "ui.featureFlags.value.enabled" : "ui.featureFlags.value.disabled"),
      percentage: flag.rolloutPercentage,
      target: flag.target,
    }),
    detailRows: [
      {
        key: translateMessage("ui.featureFlags.detail.status"),
        value: translateMessage(flag.enabled ? "ui.featureFlags.value.enabled" : "ui.featureFlags.value.disabled"),
      },
      { key: translateMessage("ui.featureFlags.detail.rollout"), value: `${flag.rolloutPercentage}%` },
      { key: translateMessage("ui.featureFlags.detail.target"), value: flag.target },
    ],
  })), [flags]);

  return {
    isLoading: query.isLoading,
    flags,
    metrics: [
      { label: translateMessage("ui.featureFlags.metric.total"), value: flags.length },
      { label: translateMessage("ui.featureFlags.metric.enabled"), value: enabledCount },
      { label: translateMessage("ui.featureFlags.metric.disabled"), value: flags.length - enabledCount },
    ],
    items,
  };
}
