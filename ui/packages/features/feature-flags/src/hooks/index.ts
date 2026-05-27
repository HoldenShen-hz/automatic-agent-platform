import { useMemo } from "react";
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
    description: `${flag.enabled ? "已启用" : "已停用"} · rollout ${flag.rolloutPercentage}% · ${flag.target}`,
    detailRows: [
      { key: "状态", value: flag.enabled ? "enabled" : "disabled" },
      { key: "灰度比例", value: `${flag.rolloutPercentage}%` },
      { key: "目标", value: flag.target },
    ],
  })), [flags]);

  return {
    isLoading: query.isLoading,
    flags,
    metrics: [
      { label: "总开关数", value: flags.length },
      { label: "已启用", value: enabledCount },
      { label: "已停用", value: flags.length - enabledCount },
    ],
    items,
  };
}
