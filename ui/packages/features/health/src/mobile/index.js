import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createHealthMobileCards(status) {
    return [
        createMobileFeatureCard("WS", status.wsStatus),
        createMobileFeatureCard("Offline Queue", String(status.offlineQueueSize)),
        createMobileFeatureCard("Sync", status.syncStatus),
    ];
}
