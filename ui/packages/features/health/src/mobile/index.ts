import { createMobileFeatureCard } from "@aa/ui-mobile";
import { translateMessage } from "@aa/shared-i18n";
import type { SystemStatusVM } from "@aa/shared-types";

export function createHealthMobileCards(status: SystemStatusVM) {
  return [
    createMobileFeatureCard(translateMessage("ui.health.mobile.ws"), status.wsStatus),
    createMobileFeatureCard(translateMessage("ui.health.mobile.offlineQueue"), String(status.offlineQueueSize)),
    createMobileFeatureCard(translateMessage("ui.health.mobile.sync"), status.syncStatus),
  ] as const;
}
