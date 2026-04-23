import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { SystemStatusVM } from "@aa/shared-types";

export function createHealthMobileCards(status: SystemStatusVM) {
  return [
    createMobileFeatureCard("WS", status.wsStatus),
    createMobileFeatureCard("Offline Queue", String(status.offlineQueueSize)),
    createMobileFeatureCard("Sync", status.syncStatus),
  ] as const;
}
