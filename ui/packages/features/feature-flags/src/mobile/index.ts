import { translateMessage } from "@aa/shared-i18n";
import type { FeatureFlagDTO } from "@aa/shared-types";

export function createFeatureFlagsMobileCards(flags: readonly FeatureFlagDTO[]) {
  return flags.map((flag) => ({
    title: flag.id,
    subtitle: translateMessage("ui.featureFlags.mobile.subtitle", {
      status: translateMessage(flag.enabled ? "ui.featureFlags.value.enabled" : "ui.featureFlags.value.disabled"),
      percentage: flag.rolloutPercentage,
    }),
  }));
}
