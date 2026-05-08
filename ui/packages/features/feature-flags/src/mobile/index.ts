import type { FeatureFlagDTO } from "@aa/shared-types";

export function createFeatureFlagsMobileCards(flags: readonly FeatureFlagDTO[]) {
  return flags.map((flag) => ({
    title: flag.id,
    subtitle: `${flag.enabled ? "enabled" : "disabled"} · rollout ${flag.rolloutPercentage}%`,
  }));
}
